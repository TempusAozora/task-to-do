function go_to_login() {
    window.location.href = '/login';
}

document.getElementById('submit').onclick = async() => {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const response = await fetch(`/register`, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username: username,
            password: password,
        })
    });

    const data = await response.json();
    const msg = data.message;

    if (data.success) {
        window.location.href = '/login';
    } else {
        alert(msg);
    };
}