import { Pool } from "pg";
import 'dotenv/config'

// Connect app to sql database
export const sql_pool = new Pool(process.env.DB_URL ? 
    {
        connectionString: process.env.DB_URL
    } : 
    {
        host: process.env.DB_HOST,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DBNAME,
    }
)


const now_utc = "(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')"
const time_if_running = `(
    CASE WHEN is_running = FALSE THEN time 
    ELSE time + EXTRACT(EPOCH FROM (${now_utc} - timestamp))
END)`

export const sql_queries = {
    // authentication
    getUserData: `SELECT username, user_id, last_login FROM users WHERE session_id = $1;`,
    checkUsername: `SELECT user_id FROM users WHERE username = $1;`,

    // get data
    getTaskData: `SELECT name, 
                    sort_order, 
                    description, 
                    ${time_if_running} AS time,  
                    uuid,
                    is_running
                    FROM task_list 
                    WHERE user_id = $1
                    ORDER BY sort_order ASC`, // one statement
    getPasswordHashed: `SELECT hash_password, user_id FROM users WHERE username = $1;`,

    // insert data
    registerUser: `INSERT INTO users (username, hash_password) VALUES ($1, $2);`,

    // create new task in task_list and initialize task data in task_data
    createTask: `WITH new_task AS (
                    INSERT INTO task_list (user_id, name, description) 
                    VALUES ($1, $2, $3)
                    RETURNING uuid
                )
                INSERT INTO task_data (uuid)
                VALUES ((SELECT uuid FROM new_task));`,

    // update data
    updateSessionID: `UPDATE users SET session_id = $1, last_login = ${now_utc} WHERE user_id = $2;`,

         // this query acts like a stopwatch for the task. utc_timestamp makes it consistent for different time zones.
    toggleTask: `WITH updated_time AS (
                    UPDATE task_list SET 
                        timestamp = (CASE WHEN is_running = FALSE THEN ${now_utc} ELSE timestamp END),
                        time = ${time_if_running},
                        is_running = NOT is_running
                    WHERE uuid = $1
                    RETURNING time
                )
                UPDATE task_data SET time = (SELECT time FROM updated_time)
                WHERE uuid = $1;`
}