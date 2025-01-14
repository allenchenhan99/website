document.addEventListener('DOMContentLoaded', () => {
    const imageContainer = document.querySelector('.image-container');
    const textContainer = document.querySelector('.text-container');
    const content = document.querySelector('.content');

    function adjustLayout() {
        if (window.innerWidth <= 768) {
            // 將 text-container 移出 image-container
            if (imageContainer.contains(textContainer)) {
                content.appendChild(textContainer); // 移動到 content 中
            }
        } else {
            // 恢復 text-container 到 image-container
            if (!imageContainer.contains(textContainer)) {
                imageContainer.appendChild(textContainer); // 放回 image-container
            }
        }
    }

    // 初始化調整佈局
    adjustLayout();

    // 監聽窗口大小變化事件
    window.addEventListener('resize', adjustLayout);
});

const app = Vue.createApp({
    data() {
        return {
            sidebarOpen: false,
            isRotating: true
        };
    },
    methods: {
        toggleSidebar(open) {
            this.sidebarOpen = open;
        },
        toggleRotation() {
            this.isRotating = !this.isRotating;
        },
        handleContentClick(event) {
            if (this.sidebarOpen && !event.target.closest('.sidebar') && !event.target.closest('.open-btn')) {
                this.toggleSidebar(false);
            }
        }
    },
    mounted() {
        document.querySelector('.content').addEventListener('click', this.handleContentClick);
    },
    beforeUnmount() {
        document.querySelector('.content').removeEventListener('click', this.handleContentClick);
    }
});

app.mount('#app');
