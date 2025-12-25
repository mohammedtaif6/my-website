
(function () {
    // --- FINAL MODAL POSITION FIX ---
    // This script moves all modals to the document body to prevent 
    // parent transforms/overflows from breaking position:fixed.

    function fixModals() {
        // 1. Find all modals
        const modals = document.querySelectorAll('.modal-overlay');

        modals.forEach(modal => {
            // Check if it's already a direct child of body
            if (modal.parentElement !== document.body) {
                // Detach from current parent and append to body
                document.body.appendChild(modal);
            }
        });

        // 2. Fix FABs as well (Floating Buttons)
        const fabs = document.querySelectorAll('.fab-btn, .fab-mini');
        fabs.forEach(btn => {
            if (btn.parentElement !== document.body) {
                document.body.appendChild(btn);
            }
        });
    }

    // Run on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fixModals);
    } else {
        fixModals();
    }

    // Safety check: Run again after a short delay (for frameworks rendering late)
    setTimeout(fixModals, 500);
    setTimeout(fixModals, 2000);

})();
