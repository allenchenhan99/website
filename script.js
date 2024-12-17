document.querySelector('form').addEventListener('submit', function(event) {
    event.preventDefault(); // 防止表單提交
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;

    if (name && email) {
        alert(`感謝您的提交！\n姓名：${name}\n電子郵件：${email}`);
    } else {
        alert('請填寫所有欄位！');
    }
});
