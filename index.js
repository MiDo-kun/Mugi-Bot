require('dotenv').config();
const express = require('express');
const login = require('facebook-chat-api');
const yt = require("yt-converter");
const request = require('request');
const fs = require('fs');

const app = express();
app.get('/', (_, res) => res.send("Initializing official messenger bot.")).listen(3300, () => console.log("Bot is starting."));

login({ appState: JSON.parse(fs.readFileSync('fbState.json', 'utf-8')) },
  (err, api) => {
    if (err) {
      const USERNAME = process.env.USERNAME_ACC;
      const PASSWORD = process.env.PASSWORD;

      // Wake up the server
      return request(process.env.FACEBOOK_COOKIE_GENERATOR, (error, response) => {
        if (!error && response.statusCode === 200) {
          console.log("Server is online.");
          // Generate new cookie
          request(process.env.FACEBOOK_COOKIE_GENERATOR +
            `/get-cookie?username=${USERNAME}&password=${PASSWORD}`, (error, response, body) => {
              if (!error && response.statusCode === 200) {
                fs.writeFile('fbState.json', body, (err) => {
                  if (err) {
                    console.log(err);
                  }
                  console.log("New fbState has been created.");
                  process.kill(0);
                })
              } else {
                console.log("Can't ping the server at the moment.");
                process.kill(0);
              }
            })
        } else {
          console.log("Server is offline.");
        }
      });
    };

    let videoID = [];
    api.setOptions({
      logLevel: "silent",
      online: "true",
      autoMarkRead: true,
    });
    api.listenMqtt((err, message) => {
      if (err) {
        console.log(err);
        process.kill(1);
      };
      
      api.handleMessageRequest(message.threadID, true, () => console.log("User who has a thread ID of " + message.threadID + " has been allowed to use the bot.")); // Access message request.

      const command = message.body || "";
      const query = command.split(" ").slice(1).join(" ") || "";

      switch (true) {
        case (command === "/commands"):
          request(process.env.COMMANDS_SERVER, (error, response, body) => {
            if (!error && response.statusCode === 200) {
              api.sendMessage(body, message.threadID, message.messageID);
            } else {
              api.sendMessage("Server is offline.", message.threadID, message.messageID);
            }
          })
          break;

        case command.startsWith("/ask"):
          if (query.trim().length === 0) {
            api.sendMessage("I can't answer if your question is empty.", message.threadID, message.messageID);
            return;
          }

          request.post({
            url: process.env.CHATGPT_SERVER,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 'question': query }),
          }, (error, response, body) => {
            if (!error && response.statusCode === 200) {
              api.sendMessage(body, message.threadID, message.messageID);
            } else {
              api.sendMessage("Server goes offline unexpectedly. Can you try again?", message.threadID, message.messageID);
            }
          })
          break;

        case command.startsWith("/wiki-search"):
          if (query.trim().length === 0) {
            api.sendMessage("Query is empty.", message.messageID, message.threadID);
            return;
          }
          request(process.env.WIKIPEDIA_SERVER + `${query}`, (error, response, body) => {
            if (!error && response.statusCode === 200) {
              api.sendMessage(body, message.threadID, message.messageID);
            } else {
              api.sendMessage("Server is offline.", message.threadID, message.messageID);
            }
          })
          break;

        case command.startsWith("/dictionary"):
          if (query.trim().length === 0) {
            api.sendMessage("Word is not defined.", message.messageID, message.threadID);
            return;
          }
          request(process.env.DICTIONARY_SERVER + `${query}`, (error, response, body) => {
            if (!error && response.statusCode === 200) {
              api.sendMessage(body, message.threadID, message.messageID);
            } else {
              api.sendMessage("Server is offline.", message.threadID, message.messageID);
            }
          })
          break;

        case (command === "/supported-languages"):
          request(process.env.COMPILER_API_SERVER + "/supported-languages", (error, response, body) => {
            if (!error && response.statusCode === 200) {
              api.sendMessage(body, message.threadID, message.messageID);
            } else {
              api.sendMessage("Server is offline.", message.threadID, message.messageID);
            }
          })
          break;

        case command.startsWith("/compile"):
          const language = command.split("-")[1].split(" ")[0];
          const code = command.split(" ").slice(1).join(" ");
          if (!language || !code) {
            api.sendMessage("Specify code and language first.", message.threadID, message.messageID);
            return;
          }
          const inputExists = code.search("Input:");
          const formatCode = inputExists !== -1 ?
            code.substr(0, inputExists - 1) : code;
          const input = inputExists !== -1 ?
            code.substr(inputExists).split('\n').slice(1).join('\n') : '';

          request.post({
            url: process.env.COMPILER_API_SERVER,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language: language, code: formatCode, input: input }),
          }, (error, response, body) => {
            if (!error && response.statusCode === 200) {
              api.sendMessage(body, message.threadID, message.messageID);
            } else {
              api.sendMessage("Server is offline.", message.threadID, message.messageID);
            }
          })
          break;

        case command.startsWith("/weather"):

          if (query.trim().length === 0) {
            api.sendMessage("City is not defined..", message.threadID, message.messageID);
            return;
          }

          request(process.env.WEATHER_SERVER + `${query}`,
            (error, response, body) => {
              if (!error && response.statusCode === 200) {
                api.sendMessage(body, message.threadID, message.messageID);
              } else {
                api.sendMessage("Server is offline.", message.threadID, message.messageID);
              }
            })
          break;

        case command.startsWith("/yt-search"):
          if (query.trim().length === 0) {
            api.sendMessage("Your query is empty.", message.threadID, message.messageID);
            return;
          }
          request.post({
            url: process.env.YOUTUBE_SERVER + `/search`,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ "query": query, "list": true }),
          }, (error, response, body) => {
            if (!error && response.statusCode === 200) {
              const result = JSON.parse(body);
              videoID = result.videoID;
              api.sendMessage(result.list, message.threadID, message.messageID);
            } else {
              api.sendMessage("Server is offline.", message.threadID, message.messageID);
            }
          })
          break;

        case command.startsWith("/play"):
          const format = command.split("-")[1].split(" ")[0];
          let index = (message.body.split(' ').slice(1).join(' '));

          if (query.trim().length === 0) {
            api.sendMessage(`${format} query is empty.`, message.threadID, message.messageID);
            return;
          }

          // Get videoID from the list.
          if (message.type === "message_reply") {
            --index; // Decrement by 1 to get the right index.
            const list = message.messageReply.body;
            const pattern = /(\d+)\.\s(.*)/g
            const matches = list.matchAll(pattern)
            const listObj = Array.from(matches, m => ({ number: m[1], title: m[2] }))

            if (!listObj[index] || videoID[index] === undefined) {
              api.sendMessage(`Can't get ${format} try again using /yt-search <query>.`, message.threadID, message.messageID);
              return;
            }
            convert(format, videoID[index]); // Download Request
          } else {
            request.post({
              url: process.env.YOUTUBE_SERVER + `/search`,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ "query": query, "list": false }),
            }, (error, response, queryID) => {
              if (!error && response.statusCode === 200) {
                convert(format, queryID); // Download Request
              } else {
                api.sendMessage("Server is offline.", message.threadID, message.messageID);
              }
            })
          }

          function convert(format, videoID) {
            request.post({
              url: process.env.YOUTUBE_SERVER + `/metadata`,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ "format": format, "videoID": videoID }),
            }, (error, response, metaData) => {
              if (!error && response.statusCode === 200) {
                download(format, JSON.parse(metaData), videoID)
                  .then((result) => {
                    api.sendMessage({
                      body: result.title,
                      attachment: fs.createReadStream(`./media/${result.videoID}.${result.format}`)
                    }, message.threadID, (err, messageInfo) => {
                      if (err)
                        throw err;
                      fs.unlinkSync(`./media/${result.videoID}.${result.format}`);
                    }, message.messageID);
                  }).catch(() => {
                    api.sendMessage("Can't send your request at the moment.", message.threadID, message.messageID);
                  })
              }
              else if (!error && response.statusCode === 400) {
                api.sendMessage(JSON.parse(metaData).error, message.threadID, message.messageID);
              }
              else {
                api.sendMessage("Can't send your request at the moment.", message.threadID, message.messageID);
              }
            })

            async function download(format, ytInfo, videoID) {
              return new Promise((resolve, _) => {
                if (format === 'music') {
                  yt.convertAudio({
                    url: ytInfo.url,
                    itag: ytInfo.audioItag,
                    directoryDownload: "./media",
                    title: videoID
                  }, (onProgress) => console.log(onProgress), (onClose) => {
                    resolve({ title: ytInfo.title, videoID: videoID, format: 'mp3' });
                  })
                }
                if (format === 'video') {
                  yt.convertVideo({
                    url: ytInfo.url,
                    itag: ytInfo.videoItag,
                    directoryDownload: "./media",
                    title: videoID
                  }, (onProgress) => console.log(onProgress), (err, data) => {
                    resolve({ title: ytInfo.title, videoID: videoID, format: 'mp4' })
                  })
                }
              })
            }
          }
          break;
      }
    });
  })