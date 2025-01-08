// Wait for the DOM to load
document.addEventListener('DOMContentLoaded', function() {
    // 獲取文字容器
    const container = document.getElementById('text-container');
    // 要填充的文字
    const text = 'I’m lost then I’m found, but it’s torture bein’ in love. Don’t let the pain control you, you’re not alone. I don’t care about what you think of me, I don’t think about you at all. They don’t understand you like I do. I’m sadder than most of you with the money and the freedom. You have to remember that you matter too. Love yourself, because no one else will. People always leave. Don’t get too attached. I’m in pain, wanna put 10 shots in my brain. I used to beat kids at school just to get her to talk to me, yellin’ at me, made me feel so low, like I ain’t had no one to talk to. It’s okay to be afraid. It’s not okay to let fear control you. I like when you’re around, but I hate when you leave. Life is worth living, so live another day. The pain in my heart just won’t end. The words that I find just don’t seem to compare. If you ever get the chance to treat them how they treated you, I hope you choose to walk away and do better. I’m alone, I’m stressed out, I’m scared, I’m paranoid. I’m in love with the thoughts, I’m in love with the memories. Kill me in my dreams and I’ll never wake up. It’s funny how the blessed ones had the most curses. I’m just tryna stay alive and take care of my people. I will never change. I will always be the same. I could never say I understand how you are all feeling, nor can I find the right words to say to you, but I do want you all to know, you are not alone. I can’t seem to find someone’s shoulder who will I put my head on, I lay in bed with a hundred and fret about things I did wrong. In life, you have to take chances. Sometimes those chances break you. I’m in need of help, I might just drown by myself. I’m outta tears to cry, so fuck it. Let the pain slide off. I gave her everything. She took my heart and left me lonely. It’s always the darkest before the dawn. I’m sippin’ Hennessy to fight away the memories. The pain inside just makes me feel so low.';
    // 初始文字內容
    let result = '';

    // 動態填充文字，直到滿足容器的高度
    function fillText() {
        // Add text-wrapping optimization
        const words = text.split(' ');
        const lineHeight = parseInt(window.getComputedStyle(container).lineHeight);
        const containerHeight = container.offsetHeight;
        const linesNeeded = Math.ceil(containerHeight / lineHeight);
        
        // Create text that better fits the container
        result = words.join(' ').repeat(linesNeeded * 2); // Multiply by 2 for safety
        container.textContent = result;
    }
    fillText();

    // 左側滑動佇列條控制
    const sidebar = document.getElementById('sidebar');
    const openSidebarButton = document.getElementById('open-sidebar');
    const closeSidebarButton = document.getElementById('close-sidebar');

    // 點擊打開佇列條
    openSidebarButton.addEventListener('click', () => {
        sidebar.classList.add('active'); // 顯示佇列條
    });

    // 點擊關閉佇列條
    closeSidebarButton.addEventListener('click', () => {
        sidebar.classList.remove('active'); // 隱藏佇列條
    });
});

