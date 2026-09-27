const quickChat = document.getElementById('quick-chat');
const quickChatToggle = document.getElementById('quick-chat-toggle');
const quickChatPanel = document.getElementById('quick-chat-panel');

if (quickChat && quickChatToggle && quickChatPanel) {
    const setQuickChatOpen = (open) => {
        quickChatPanel.hidden = !open;
        quickChatToggle.setAttribute('aria-expanded', String(open));
        quickChatToggle.setAttribute('aria-label', open ? 'Close chat options' : 'Open chat options');
    };

    quickChatToggle.addEventListener('click', () => {
        setQuickChatOpen(quickChatPanel.hidden);
    });

    document.addEventListener('click', (event) => {
        if (event.target instanceof Node && !quickChat.contains(event.target)) {
            setQuickChatOpen(false);
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !quickChatPanel.hidden) {
            setQuickChatOpen(false);
            quickChatToggle.focus();
        }
    });
}
