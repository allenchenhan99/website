const app = Vue.createApp({
    data() {
        return {
            sidebarOpen: false, // 側邊欄的開啟狀態
            text: 'I\'m lost then I\'m found, but it\'s torture bein\' in love. Don\'t let the pain control you, you\'re not alone. I don\'t care about what you think of me, I don\'t think about you at all. They don\'t understand you like I do. I\'m sadder than most of you with the money and the freedom. You have to remember that you matter too. Love yourself, because no one else will. People always leave. Don\'t get too attached. I\'m in pain, wanna put 10 shots in my brain. I used to beat kids at school just to get her to talk to me...',
            repeatedText: '', // 動態填充的文字
            asciiArt: '' // ASCII art content
        };
    },
    mounted() {
        this.fillText(); // 當應用掛載後填充文字
        this.loadAsciiArt(); // Load ASCII art when mounted
    },
    methods: {
        toggleSidebar(open) {
            this.sidebarOpen = open;
        },
        fillText() {
            const containerHeight = 400; // 文字覆蓋容器高度 (需與 CSS 高度一致)
            const lineHeight = 8; // 行高 (需與 CSS 行高一致)
            const linesNeeded = Math.ceil(containerHeight / lineHeight);

            // 填充足夠的文字以覆蓋容器
            this.repeatedText = this.text.repeat(linesNeeded);
        },
        loadAsciiArt() {
            fetch('asciiArt.txt')
                .then((response) => response.text())
                .then((asciiArt) => {
                    const asciiElement = document.getElementById('ascii-art');
                    let index = 0;

                    // Typing effect function
                    const typeEffect = () => {
                        if (index < asciiArt.length) {
                            asciiElement.textContent += asciiArt[index];
                            index++;

                            // Move to the next line if the character is '\n'
                            if (asciiArt[index - 1] === '\n') {
                                asciiElement.textContent += '\n';
                            }

                            setTimeout(typeEffect, 10); // Typing speed (10 ms per character)
                        }
                    };

                    typeEffect();
                })
                .catch((error) => console.error('Error fetching ASCII art:', error));
        }
    }
});

app.mount('#app');
