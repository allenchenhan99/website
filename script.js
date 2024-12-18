// 獲取文字容器
const container = document.getElementById('text-container');
// 要填充的文字
const text = 'Test for pictures ';
// 初始文字內容
let repeatedText = '';

// 動態填充文字，直到滿足容器的高度
while (container.scrollHeight <= container.offsetHeight) {
    repeatedText += text; // 不斷添加文字
    container.textContent = repeatedText; // 將文字添加到容器
}

// 適配文字的額外設置
container.textContent = repeatedText.trim(); // 去除多餘空格
