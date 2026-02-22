function go_to_register() {
    window.location.href = '/register';
}

document.getElementById('submit').onclick = async() => {
    const username = document.getElementById('username');
    const password = document.getElementById('password');

    const response = await fetch(`/login`, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username: username.value,
            password: password.value,
        })
    });

    const data = await response.json();
    const msg = data.message;

    if (data.success) {
        window.location.href = '/home';

        const date = new Date();
        const time = date.getTime();
        const days = 1;

        var expireTime = time + 1000 * 60 * 60 * 24 * days; // 1 day. Milliseconds * seconds * minutes * hours * days
        date.setTime(expireTime);

        document.cookie = "SESSION_ID" + "=" + data.cookie + "; expires=" + date.toUTCString() + "; path=/";
    } else {
        alert(msg);
        password.value = '';
    };
}