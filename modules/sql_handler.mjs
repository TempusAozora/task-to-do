import { createPool } from 'mysql2/promise';
import 'dotenv/config'

// Connect app to sql database
export const sql_pool = createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,

    database: process.env.DB_DBNAME,
    ssl: { rejectUnauthorized: false },
    multipleStatements: false
});

export const sql_queries = {
    // authentication
    getUserData: "SELECT username, user_id, last_login FROM users WHERE session_id = ?;",
    checkUsername: "SELECT user_id FROM users WHERE username = ?;",

    // get data
    getTaskData: `SELECT task_name, 
                    task_order, 
                    task_description, 
                    (
                        CASE WHEN is_running = 0 THEN task_time 
                        ELSE task_time + TIMESTAMPDIFF(MICROSECOND, task_timestamp, UTC_TIMESTAMP(2)) / 1000000
                    END) AS task_time,  
                    BIN_TO_UUID(task_uuid) AS task_uuid,
                    is_running
                    FROM tasks 
                    WHERE user_id = ?
                    ORDER BY task_order ASC`, // one statement
    getPasswordHashed: "SELECT password, user_id FROM users WHERE username = ?;",

    // insert data
    registerUser: "INSERT INTO users (username, password) VALUES (?, ?);",

        // send task data to database and increment by order
        // Generates UUID on a task for easier identification
    createTask: `INSERT INTO tasks (user_id, task_order, task_name, task_description, task_uuid) 
                VALUES (?, (SELECT * FROM (SELECT COALESCE(MAX(task_order), 0) FROM tasks WHERE user_id = ?) AS X)+1, ?, ?, UUID_TO_BIN(?));`,

                
    // update data
    updateSessionID: "UPDATE users SET session_id = ?, last_login = UTC_TIMESTAMP() WHERE user_id = ?;",

         // this query acts like a stopwatch for the task. utc_timestamp makes it consistent for different time zones.
        // DATETIME is used instead of TIMESTAMP because TIMESTAMP will break by the year 2038.
    toggleTask: `UPDATE tasks
                SET task_timestamp = (CASE WHEN is_running = 0 THEN utc_timestamp(2) ELSE task_timestamp END),
                    task_time = (
                        CASE WHEN is_running = 0 THEN task_time 
                        ELSE task_time + TIMESTAMPDIFF(MICROSECOND, task_timestamp, UTC_TIMESTAMP(2)) / 1000000
                    END),
                    is_running = !is_running
                WHERE task_uuid = UUID_TO_BIN(?);`
}