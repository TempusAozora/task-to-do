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

export const sql_queries = {
    // authentication
    getUserData: `SELECT username, user_id, last_login FROM users WHERE session_id = $1;`,
    checkUsername: `SELECT user_id FROM users WHERE username = $1;`,

    // get data
    getTaskData: `SELECT name, 
                    sort_order, 
                    description, 
                    (
                        CASE WHEN is_running = FALSE THEN time 
                        ELSE time + EXTRACT(EPOCH FROM ((SELECT CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - timestamp))
                    END) AS time,  
                    uuid,
                    is_running
                    FROM task_list 
                    WHERE user_id = $1
                    ORDER BY sort_order ASC`, // one statement
    getPasswordHashed: `SELECT hash_password, user_id FROM users WHERE username = $1;`,

    // insert data
    registerUser: `INSERT INTO users (username, hash_password) VALUES ($1, $2);`,

        // send task data to database and increment by order
        // Generates UUID on a task for easier identification
    createTask: `INSERT INTO task_list (user_id, sort_order, name, description, uuid) 
                VALUES ($1, (SELECT * FROM (SELECT COALESCE(MAX(sort_order), 0) FROM task_list WHERE user_id = $2) AS X)+1, $3, $4, $5);`,

                
    // update data
    updateSessionID: `UPDATE users SET session_id = $1, last_login = (SELECT CURRENT_TIMESTAMP AT TIME ZONE 'UTC') WHERE user_id = $2;`,

         // this query acts like a stopwatch for the task. utc_timestamp makes it consistent for different time zones.
    toggleTask: `UPDATE task_list
                SET timestamp = (CASE WHEN is_running = FALSE THEN (SELECT CURRENT_TIMESTAMP AT TIME ZONE 'UTC') ELSE timestamp END),
                    time = (
                        CASE WHEN is_running = FALSE THEN time 
                        ELSE time + EXTRACT(EPOCH FROM ((SELECT CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - timestamp))
                    END),
                    is_running = NOT is_running
                WHERE uuid = $1;`
}