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


const now_utc = "(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::timestamptz"
const increment_if_running = `(
    CASE WHEN tl.is_running = FALSE THEN 0
    ELSE EXTRACT(EPOCH FROM (${now_utc} - ("timestamp" AT TIME ZONE 'UTC')::timestamptz))
END)`

export const sql_queries = {
    // authentication
    getUserData: `SELECT username, user_id, last_login FROM users WHERE session_id = $1;`,
    checkUsername: `SELECT user_id FROM users WHERE username = $1;`,

    // get data
    getTaskList: `SELECT tl.name, 
                    tl.sort_order, 
                    tl.description, 
                    td.t_time + ${increment_if_running} AS time,  
                    tl."uuid",
                    tl.is_running
                FROM task_list tl
                FULL JOIN task_data td ON tl."uuid" = td."uuid" AND td."date" = ${now_utc}::date
                WHERE user_id = $1
                ORDER BY sort_order ASC`, // one statement
    getTaskData: `SELECT tl."uuid", td."date", td.t_time AS time
                FROM task_data td
                INNER JOIN task_list tl on tl.uuid = td.uuid
                INNER JOIN users u on u.user_id = tl.user_id
                WHERE u.user_id = $1
                ORDER BY td."date" DESC`,
    getPasswordHashed: `SELECT hash_password, user_id FROM users WHERE username = $1;`,

    // insert data
    registerUser: `INSERT INTO users (username, hash_password) VALUES ($1, $2);`,
    createTask: `INSERT INTO task_list (user_id, name, description) VALUES ($1, $2, $3) RETURNING uuid`,

    // delete data
    deleteTask: `WITH deleted_task AS (
                    DELETE FROM task_data
                    WHERE uuid = ANY($1)
                )
                DELETE FROM task_list
                WHERE uuid = ANY($1);`,

    // update data
    updateSessionID: `UPDATE users SET session_id = $1, last_login = ${now_utc} WHERE user_id = $2;`,

    // upsert data
    // update task list and upsert task data
    toggleTask: `CALL toggle_task($1, $2);`,
}