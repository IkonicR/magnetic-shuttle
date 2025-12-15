/**
 * Magnetic Shuttle - Background Service Worker
 * 
 * Drag tabs left to pin, drag right to unpin.
 * Premium, frictionless tab management.
 */

// Debounce tracking - only act on the FINAL position after drag completes
const dragDebounce = new Map();
const DEBOUNCE_DELAY = 600; // Snappier response (was 1000ms)

/**
 * Get the count of pinned tabs in a window
 */
async function getPinnedTabCount(windowId) {
    const tabs = await chrome.tabs.query({ windowId, pinned: true });
    return tabs.length;
}

/**
 * Flash the extension badge to provide visual feedback
 */
async function flashBadge(text, color) {
    await chrome.action.setBadgeText({ text });
    await chrome.action.setBadgeBackgroundColor({ color });

    setTimeout(async () => {
        await chrome.action.setBadgeText({ text: '' });
    }, 1500);
}

/**
 * Execute pin/unpin with exponential backoff for Chrome's drag lock
 * After pin/unpin, moves tab to the target index if specified
 */
async function executeWithRetry(tabId, action, targetIndex = null, maxRetries = 15) {
    console.log(`[Magnetic Shuttle] 🔄 Starting ${action} operation (target index: ${targetIndex})...`);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const tab = await chrome.tabs.get(tabId);

            if (action === 'pin' && !tab.pinned) {
                await chrome.tabs.update(tabId, { pinned: true });

                // Move to target position within pinned zone (default: leftmost = 0)
                const moveToIndex = targetIndex !== null ? Math.min(targetIndex, await getPinnedTabCount(tab.windowId) - 1) : 0;
                await chrome.tabs.move(tabId, { index: moveToIndex });

                await flashBadge('📌', '#4CAF50');
                console.log(`[Magnetic Shuttle] ✅ Pinned at index ${moveToIndex}: "${tab.title?.substring(0, 30)}..."`);
                return true;
            } else if (action === 'unpin' && tab.pinned) {
                const pinnedCount = await getPinnedTabCount(tab.windowId);
                await chrome.tabs.update(tabId, { pinned: false });

                // Move to target position in unpinned zone
                // targetIndex is relative to where they dropped it; after unpinning we adjust
                if (targetIndex !== null) {
                    // They dropped at targetIndex (which was in pinned zone)
                    // After unpin, Chrome moves it to pinnedCount-1 (first unpinned slot)
                    // We want to keep it as close to original drop as possible
                    const newPinnedCount = pinnedCount - 1;
                    const moveToIndex = Math.max(newPinnedCount, targetIndex);
                    await chrome.tabs.move(tabId, { index: moveToIndex });
                    console.log(`[Magnetic Shuttle] ✅ Unpinned at index ${moveToIndex}: "${tab.title?.substring(0, 30)}..."`);
                } else {
                    console.log(`[Magnetic Shuttle] ✅ Unpinned: "${tab.title?.substring(0, 30)}..."`);
                }

                await flashBadge('📤', '#FF9800');
                return true;
            }
            console.log(`[Magnetic Shuttle] ⏩ Tab already in desired state`);
            return true; // Already in desired state
        } catch (error) {
            if (error.message.includes('user may be dragging')) {
                // Exponential backoff starts faster now: 100ms
                const delay = Math.min(100 * Math.pow(1.5, attempt), 2000);
                console.log(`[Magnetic Shuttle] ⏳ Retry ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error(`[Magnetic Shuttle] ❌ Error:`, error.message);
                return false;
            }
        }
    }
    console.error(`[Magnetic Shuttle] ❌ FAILED: Exhausted all ${maxRetries} retries`);
    return false;
}

/**
 * Process the final tab position after drag completes
 * Uses MAGNETIC ZONES - wider target areas for forgiving detection
 */
async function processFinalPosition(tabId) {
    try {
        const tab = await chrome.tabs.get(tabId);
        const pinnedCount = await getPinnedTabCount(tab.windowId);

        console.log(`[Magnetic Shuttle] Final position: "${tab.title?.substring(0, 25)}..." at index ${tab.index}`);
        console.log(`  Tab pinned: ${tab.pinned} | Window has ${pinnedCount} pinned tabs`);

        // ===== PIN DETECTION =====
        // ONLY pin if:
        // 1. No pinned tabs exist AND tab is at position 0 (creating first pin), OR
        // 2. Tab is at EXACTLY the pin boundary (position pinnedCount)
        if (!tab.pinned) {
            const isFirstPin = pinnedCount === 0 && tab.index === 0;
            const atExactBoundary = pinnedCount > 0 && tab.index === pinnedCount;

            if (isFirstPin || atExactBoundary) {
                console.log(`[Magnetic Shuttle] 📌 Pinning at position ${tab.index}!`);
                await executeWithRetry(tabId, 'pin', tab.index);
                return;
            }
        }

        // ===== UNPIN DETECTION =====  
        // Pinned tab in the LAST 2 positions of the pinned zone (or the only pinned tab)
        if (tab.pinned && pinnedCount >= 1) {
            const unpinZoneStart = Math.max(0, pinnedCount - 2); // Last 2 spots
            const inUnpinZone = tab.index >= unpinZoneStart;

            console.log(`  UNPIN check: index ${tab.index} >= ${unpinZoneStart} = ${inUnpinZone}`);

            if (inUnpinZone) {
                console.log(`[Magnetic Shuttle] 📤 Unpinning from position ${tab.index}!`);
                await executeWithRetry(tabId, 'unpin', tab.index);
                return;
            }
        }

        console.log(`[Magnetic Shuttle] ⏭️ No action`);

    } catch (error) {
        console.error('[Magnetic Shuttle] Process error:', error.message);
    }
}

/**
 * Handle tab movement events - debounced to wait for drag completion
 */
chrome.tabs.onMoved.addListener(async (tabId, moveInfo) => {
    // Clear any pending action for this tab
    if (dragDebounce.has(tabId)) {
        clearTimeout(dragDebounce.get(tabId));
    }

    console.log(`[Magnetic Shuttle] Move: index ${moveInfo.fromIndex} → ${moveInfo.toIndex}`);

    // Set a debounced action - will fire 1 second after user stops dragging
    const timeoutId = setTimeout(() => {
        dragDebounce.delete(tabId);
        processFinalPosition(tabId);
    }, DEBOUNCE_DELAY);

    dragDebounce.set(tabId, timeoutId);
});

/**
 * Clean up on tab close
 */
chrome.tabs.onRemoved.addListener((tabId) => {
    if (dragDebounce.has(tabId)) {
        clearTimeout(dragDebounce.get(tabId));
        dragDebounce.delete(tabId);
    }
});

/**
 * Extension icon click OR keyboard shortcut - toggle pin/unpin for active tab
 * Fallback for edge cases where dragging doesn't work
 */
async function togglePinActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    if (tab.pinned) {
        await chrome.tabs.update(tab.id, { pinned: false });
        await flashBadge('📤', '#FF9800');
        console.log(`[Magnetic Shuttle] 📤 Toggled unpin: "${tab.title?.substring(0, 30)}..."`);
    } else {
        await chrome.tabs.update(tab.id, { pinned: true });
        await flashBadge('📌', '#4CAF50');
        console.log(`[Magnetic Shuttle] 📌 Toggled pin: "${tab.title?.substring(0, 30)}..."`);
    }
}

// Icon click
chrome.action.onClicked.addListener(togglePinActiveTab);

// Keyboard shortcut (Cmd+Shift+P on Mac, Ctrl+Shift+P on others)
chrome.commands.onCommand.addListener((command) => {
    if (command === 'toggle-pin') {
        togglePinActiveTab();
    }
});

console.log('[Magnetic Shuttle] Extension loaded and ready! 🧲');
console.log('[Magnetic Shuttle] Tip: Use Cmd+Shift+P (Mac) or Ctrl+Shift+P to toggle pin');
