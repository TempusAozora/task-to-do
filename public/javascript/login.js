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
        document.cookie = "SESSION_ID" + "=" + data.cookie + "; expires=" + data.validity_duration + "; path=/";
    } else {
        alert(msg);
        password.value = '';
    };
}