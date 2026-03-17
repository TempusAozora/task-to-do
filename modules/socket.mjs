import { sql_pool, sql_queries } from './sql_handler.mjs';
import validation from './validation.mjs';
import { WebSocketServer } from 'ws';

const HEARTBEAT_INTERVAL = 10 * 1000 // 10 seconds
const HEARTBEAT_TIMEOUT = 12 * 1000 // 12 seconds for client

const HEARTBEAT_VALUE = 1;

function handle_error(err) {
    console.error(err)
}

function create_response(type, payload) {
    return JSON.stringify({type, payload})
}

function ping(ws) {
    ws.send(HEARTBEAT_VALUE, {binary: true})
}

function pong(ws, req) {
    // console.log(`${(new Date()).toUTCString()} ${req.userdata.username} pong`);
    ws.isAlive = true
}

export default function connectSocket(server) {
    const wss = new WebSocketServer({noServer: true});

    server.on('upgrade', async function(req, socket, head) {
        const [is_session_id_valid, userdata] = await validation.getUserData(req)

        if (is_session_id_valid) { // if session id is valid and at home page
            wss.handleUpgrade(req, socket, head, (ws) => {
                req.userdata = userdata
                wss.emit('connection', ws, req); // accept connection
            });
        } else {
            socket.destroy()
        }
    })

    wss.on('connection', function(ws, req) {
        ws.on('error', console.error);

        ws.isAlive = true
        console.log(`${(new Date()).toUTCString()} ${req.userdata.username} connected`);
        ws.send(create_response("connectionSuccess", {
            HEARTBEAT_TIMEOUT: HEARTBEAT_TIMEOUT, 
            HEARTBEAT_VALUE: HEARTBEAT_VALUE
        }))
        
        ws.on('message', async function(data, isBinary) {
            if (isBinary && data[0] === HEARTBEAT_VALUE) { // pong
                return pong(ws, req)
            }

            const {type, payload} = JSON.parse(data.toString())
            let response;
            
            if (type === "createTask") {
                // validate name and description (WIP)
                let returned_values;
                try {
                    returned_values = (await sql_pool.query(sql_queries.createTask, [req.userdata.user_id, payload.name, payload.description])).rows[0];
                } catch (error) {
                    // send error message wip
                    return handle_error(error)
                }
                response = create_response(type, {status: 200, uuid: returned_values.uuid, name: payload.name, description: payload.description})
            } else if (type === "toggleTask") {
                // reduce request (WIP)
                try {
                    await sql_pool.query(sql_queries.toggleTask, [payload.uuid, payload.timezone])
                } catch (error) {
                    // send error message wip
                    return handle_error(error)
                }
                response = create_response(type, {status: 200, uuid: payload.uuid})
            } else if (type === "deleteTask") {
                try {
                    await sql_pool.query(sql_queries.deleteTask, [payload.tasks])
                } catch (error) {
                    // send error message wip
                    return handle_error(error)
                }
                response = create_response(type, {status: 200})
            } else {
                response = create_response("error", {message: "websocket message is not valid"})
            }

            ws.send(response)
        })

        ws.on('close', (event, reason) => {
            console.log(`${(new Date()).toUTCString()} ${req.userdata.username} disconnected. Close code: ${event}. Reason: ${reason.toString()}`)
        })
    })

    const interval = setInterval(() => {
        wss.clients.forEach((client) => {
            if (!client.isAlive) return client.terminate();

            client.isAlive = false;
            ping(client);
        })
    }, HEARTBEAT_INTERVAL)

    wss.on('close', () => {
        clearInterval(interval);
    })
}