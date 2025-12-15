/**
 * Magnetic Shuttle - Background Service Worker
 * https://github.com/IkonicR/magnetic-shuttle
 * 
 * Drag tabs left to pin, drag right to unpin.
 * Frictionless tab management for Chrome.
 * 
 * @license MIT
 */

const dragDebounce = new Map();
const DEBOUNCE_DELAY = 600;

async function getPinnedTabCount(windowId) {
    const tabs = await chrome.tabs.query({ windowId, pinned: true });
    return tabs.length;
}

async function flashBadge(text, color) {
    await chrome.action.setBadgeText({ text });
    await chrome.action.setBadgeBackgroundColor({ color });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1500);
}

async function executeWithRetry(tabId, action, targetIndex = null, maxRetries = 15) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const tab = await chrome.tabs.get(tabId);

            if (action === 'pin' && !tab.pinned) {
                await chrome.tabs.update(tabId, { pinned: true });
                const moveToIndex = targetIndex !== null 
                    ? Math.min(targetIndex, await getPinnedTabCount(tab.windowId) - 1) 
                    : 0;
                await chrome.tabs.move(tabId, { index: moveToIndex });
                await flashBadge('📌', '#4CAF50');
                return true;
            } 
            
            if (action === 'unpin' && tab.pinned) {
                const pinnedCount = await getPinnedTabCount(tab.windowId);
                await chrome.tabs.update(tabId, { pinned: false });
                if (targetIndex !== null) {
                    const newPinnedCount = pinnedCount - 1;
                    const moveToIndex = Math.max(newPinnedCount, targetIndex);
                    await chrome.tabs.move(tabId, { index: moveToIndex });
                }
                await flashBadge('📤', '#FF9800');
                return true;
            }
            
            return true;
        } catch (error) {
            if (error.message.includes('user may be dragging')) {
                const delay = Math.min(100 * Math.pow(1.5, attempt), 2000);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                return false;
            }
        }
    }
    return false;
}

async function processFinalPosition(tabId) {
    try {
        const tab = await chrome.tabs.get(tabId);
        const pinnedCount = await getPinnedTabCount(tab.windowId);

        // Pin detection: position 0 (first pin) or at exact boundary
        if (!tab.pinned) {
            const isFirstPin = pinnedCount === 0 && tab.index === 0;
            const atExactBoundary = pinnedCount > 0 && tab.index === pinnedCount;
            if (isFirstPin || atExactBoundary) {
                await executeWithRetry(tabId, 'pin', tab.index);
                return;
            }
        }

        // Unpin detection: last 2 positions of pinned zone
        if (tab.pinned && pinnedCount >= 1) {
            const unpinZoneStart = Math.max(0, pinnedCount - 2);
            if (tab.index >= unpinZoneStart) {
                await executeWithRetry(tabId, 'unpin', tab.index);
                return;
            }
        }
    } catch (error) {
        // Tab may have been closed
    }
}

chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
    if (dragDebounce.has(tabId)) {
        clearTimeout(dragDebounce.get(tabId));
    }
    const timeoutId = setTimeout(() => {
        dragDebounce.delete(tabId);
        processFinalPosition(tabId);
    }, DEBOUNCE_DELAY);
    dragDebounce.set(tabId, timeoutId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
    if (dragDebounce.has(tabId)) {
        clearTimeout(dragDebounce.get(tabId));
        dragDebounce.delete(tabId);
    }
});

async function togglePinActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    
    if (tab.pinned) {
        await chrome.tabs.update(tab.id, { pinned: false });
        await flashBadge('📤', '#FF9800');
    } else {
        await chrome.tabs.update(tab.id, { pinned: true });
        await flashBadge('📌', '#4CAF50');
    }
}

chrome.action.onClicked.addListener(togglePinActiveTab);

chrome.commands.onCommand.addListener((command) => {
    if (command === 'toggle-pin') {
        togglePinActiveTab();
    }
});
