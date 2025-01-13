const app = Vue.createApp({
    data() {
        return {
            sidebarOpen: false,
            asciiArt: '',
            currentCharIndex: 0,
            currentFrame: 0,
            totalFrames: 22,
            animationInterval: null,
            animationStartTime: null
        };
    },
    mounted() {
        this.loadAsciiArt();
        this.startAnimation();
    },
    methods: {
        toggleSidebar(open) {
            this.sidebarOpen = open;
        },
        loadAsciiArt() {
            fetch('asciiArt.txt')
                .then(response => response.text())
                .then(art => {
                    this.asciiArt = art;
                    this.typeAsciiArt();
                })
                .catch(error => console.error('Error loading ASCII art:', error));
        },
        typeAsciiArt() {
            const target = document.getElementById("ascii-art");
            const lines = this.asciiArt.split('\n');
            let currentBlock = 0;
            
            // 定義每個區塊的寬度順序
            const blockWidths = [
                10, 8, 8, 8, 9, 11, 8, 4, 9, 9,  // 第一行的區塊
                11, 9, 4, 8, 8, 8, 8, 9, 10, 8, 8, 4, 8, 8, 9, 9  // 第二行的區塊
            ];
            
            const displayNextBlock = () => {
                if (currentBlock < blockWidths.length) {
                    const width = blockWidths[currentBlock];
                    let blockContent = '';
                    
                    // 確定當前區塊的起始位置
                    let startPos = 0;
                    if (currentBlock < 10) {
                        // 第一行的區塊
                        for (let i = 0; i < currentBlock; i++) {
                            startPos += blockWidths[i];
                        }
                    } else {
                        // 第二行的區塊，重新從0開始計算
                        for (let i = 10; i < currentBlock; i++) {
                            startPos += blockWidths[i];
                        }
                    }
                    
                    // 如果是第二行的區塊，需要調整起始行
                    const startLine = currentBlock < 10 ? 0 : 9;
                    
                    // 構建區塊內容（6行）
                    for (let i = 0; i < 6; i++) {
                        const line = lines[startLine + i];
                        blockContent += line.substr(startPos, width) + '\n';
                    }
                    
                    // 添加區塊到顯示區域
                    if (currentBlock === 0) {
                        target.textContent = blockContent;
                    } else if (currentBlock === 10) {
                        // 添加三個換行後再繼續
                        target.textContent += '\n\n\n' + blockContent;
                    } else {
                        // 將新區塊添加到對應行的末尾
                        const currentLines = target.textContent.split('\n');
                        const newLines = blockContent.split('\n');
                        
                        for (let i = 0; i < 6; i++) {
                            if (currentBlock < 10) {
                                currentLines[i] = (currentLines[i] || '') + newLines[i];
                            } else {
                                currentLines[i + 9] = (currentLines[i + 9] || '') + newLines[i];
                            }
                        }
                        target.textContent = currentLines.join('\n');
                    }
                    
                    currentBlock++;
                    setTimeout(displayNextBlock, 100);
                }
            };

            displayNextBlock();
        },
        startAnimation() {
            if (this.animationInterval) {
                clearInterval(this.animationInterval);
            }

            const animationImg = document.querySelector('.ascii-animation img');
            this.animationStartTime = Date.now();
            
            this.animationInterval = setInterval(() => {
                const elapsedTime = Date.now() - this.animationStartTime;
                const fadeInDuration = 3000; // 3秒淡入
                
                // 計算當前透明度
                if (elapsedTime < fadeInDuration) {
                    // 在前3秒內，opacity從0.05逐漸增加到1
                    const opacity = 0.05 + (elapsedTime / fadeInDuration) * 0.95;
                    animationImg.style.opacity = opacity;
                } else {
                    // 3秒後保持完全不透明
                    animationImg.style.opacity = 1;
                }
                
                // 更新圖片
                animationImg.src = `asciiart/${this.currentFrame}.png`;
                this.currentFrame = (this.currentFrame + 1) % (this.totalFrames + 1);
            }, 20);
        }
    },
    beforeUnmount() {
        // 組件銷毀前清除動畫interval
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
        }
    }
});

app.mount("#app");
