const app = Vue.createApp({
    data() {
        return {
            darkMode: true,
            asciiArt: '',
            currentCharIndex: 0,
            currentFrame: 0,
            totalFrames: 22,
            animationInterval: null,
            animationStartTime: null,
            asciiArtContent: [],
            currentBatch: 0,
            rowsPerBatch: 42,
            totalBatches: 23,
        };
    },
    mounted() {
        // Load theme preference
        const saved = localStorage.getItem('theme');
        if (saved) {
            this.darkMode = saved === 'dark';
        } else {
            this.darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        this.applyTheme();

        this.loadAsciiArt();
        this.loadChipiContent();
    },
    methods: {
        toggleTheme() {
            this.darkMode = !this.darkMode;
            localStorage.setItem('theme', this.darkMode ? 'dark' : 'light');
            this.applyTheme();
        },
        applyTheme() {
            document.documentElement.setAttribute('data-theme', this.darkMode ? 'dark' : 'light');
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

            const blockWidths = [
                10, 8, 8, 8, 9, 11, 8, 4, 9, 9,
                11, 9, 4, 8, 8, 8, 8, 9, 10, 8, 8, 4, 8, 8, 9, 9
            ];

            const displayNextBlock = () => {
                if (currentBlock < blockWidths.length) {
                    const width = blockWidths[currentBlock];
                    let blockContent = '';

                    let startPos = 0;
                    if (currentBlock < 10) {
                        for (let i = 0; i < currentBlock; i++) {
                            startPos += blockWidths[i];
                        }
                    } else {
                        for (let i = 10; i < currentBlock; i++) {
                            startPos += blockWidths[i];
                        }
                    }

                    const startLine = currentBlock < 10 ? 0 : 9;

                    for (let i = 0; i < 6; i++) {
                        const line = lines[startLine + i];
                        blockContent += line.substr(startPos, width) + '\n';
                    }

                    if (currentBlock === 0) {
                        target.textContent = blockContent;
                    } else if (currentBlock === 10) {
                        target.textContent += '\n\n\n' + blockContent;
                    } else {
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
        loadChipiContent() {
            fetch('chipi.txt')
                .then(response => response.text())
                .then(data => {
                    this.asciiArtContent = data.split('\n');
                    this.displayNextChipiBatch();
                })
                .catch(error => console.error('Error loading chipi content:', error));
        },
        displayNextChipiBatch() {
            const chipiElement = document.getElementById('chipi-animation');
            if (this.currentBatch < this.totalBatches) {
                const start = this.currentBatch * this.rowsPerBatch;
                const end = start + this.rowsPerBatch;
                const batchContent = this.asciiArtContent.slice(start, end).join('\n');
                chipiElement.textContent = batchContent;
                this.currentBatch++;
                setTimeout(this.displayNextChipiBatch, 20);
            } else {
                this.currentBatch = 0;
                setTimeout(this.displayNextChipiBatch, 20);
            }
        },
    }
});

app.mount("#app");
