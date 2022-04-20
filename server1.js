process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const express = require('express')
const axios = require('axios')
const DB_CONFIG = process.env.DB_CONFIG
const Pool = require('pg').Pool
const cors = require('cors');
const url = 'http://localhost:8081'
const openShiftURL = 'https://cloud-server-2-cloud-final.apps-crc.testing/'

var cn = new Pool({
    connectionString: DB_CONFIG,
    ssl: false,
})

// var cn = new Pool({
//     host: 'localhost',
//     user: 'aleventis',
//     port: '5432',
//     database: 'cloud_final',
// })

const app = express()
app.use(cors({origin: true}))
const port = 8082

const getGameData = async () => {
    try {
        const r = await cn.query(`SELECT * FROM rpc`);
        if (r.rows[0].name === "server2"){
            [r.rows[0], r.rows[1]] = [r.rows[1], r.rows[0]]
        }
        return r.rows
    } catch (err) {
        return err
    }
}

const updateDB = async data => { 
    var champ
    var loser
    if (data["champion"] === "tie") return
    if (data["champion"]==="server 1") { champ = "server1" }
    if (data["champion"]==="server 2") { champ = "server2" }
    loser = champ === "server1" ? "server2" : "server1"

    await cn.query(`UPDATE rpc SET wins=wins+1, current_streak=current_streak+1 WHERE name = $1`, [champ])
    await cn.query(`UPDATE rpc SET current_streak=0 where name=$1`, [loser])

    cn.query(`SELECT wins, current_streak, longest_win_streak FROM rpc where name = $1`, [champ], (err, res) => {
       if (err) { return error }
       [cs, ls] = [res.rows[0].current_streak, res.rows[0].longest_win_streak]
       if (cs >= ls) {
            cn.query(`UPDATE rpc SET longest_win_streak=$1 where name=$2`, [cs, champ])
       }
    })
}

const pickRandom = () => {
    const rpc = ["rock", "paper", "scissors"];
    return rpc[Math.floor(Math.random() * 3)];
}

// Picks random move (rock, paper scissors)
// sends move to server2 and await it's response
// receive and update database with result (win/lose)
// return response data to client
app.get('/send', async (req, res) => {
    let move = pickRandom()

    try {
        // send move to server 2
        let gameResult = await axios.post(openShiftURL, {move: move})
        await updateDB(gameResult.data)
        res.send(gameResult.data)
    } catch (err) {
        res.send(err)
    }
});

// retrieve database data and return to client
app.get('/results', async (req, res) => {
    const results = await getGameData()
    if (results[0].name === "server2"){
        [results[0], results[1]] = [results[1], results[0]]
    }
    res.send(results)
})

app.listen(port, () => { console.log(`Listening on port ${port}`) })