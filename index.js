const { Client, Intents } = require("discord.js");

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
} = require("@discordjs/voice");
const ytdlCore = require("ytdl-core");
const fs = require("fs");

const client = new Client({
  shards: "auto",
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_VOICE_STATES,
    Intents.FLAGS.GUILD_MESSAGES,
  ],
});

const token = "Njc5ODAzNjc4NTc1ODIwODUy.Xk2qgw.80EKUwbypFUTtVrG5Z2w-JhO-nk";

const Channels = ["827144251384659978", "826950998740303942"];

client.on("ready", async () => {
  console.log(`Iniciado sesión como ${client.user.username}`);

  client.user.setPresence({
    activities: [{ name: "!audio <link>", type: "WATCHING" }],
    status: "dnd",
  });

  for (const channelId of Channels) {
    joinChannel(channelId);
    await new Promise((res) => setTimeout(() => res(2), 500));
  }

  function joinChannel(channelId) {
    client.channels
      .fetch(channelId)
      .then((channel) => {
        const VoiceConnection = joinVoiceChannel({
          channelId: channel.id,
          guildId: channel.guild.id,
          adapterCreator: channel.guild.voiceAdapterCreator,
        });

        /*
        PARA YTDL:
            highWaterMark: 1024 * 1024 * 64,
            quality: "highestaudio",
            filter: "audioonly",
            fmt: "mp3",
            encoderArgs: [
              "-af",
              //"asetrate=44100*1,bass=g=0",
              "asetrate=44100*1.00,bass=g=100",
            ],
          }),
        */

        const resource = createAudioResource(
          "https://streams.ilovemusic.de/iloveradio109.mp3",
          {
            inlineVolume: true,
          }
        );
        resource.volume.setVolume(0.2);
        const player = createAudioPlayer();
        VoiceConnection.subscribe(player);
        player.play(resource);
        player.on("idle", () => {
          try {
            player.play(resource);
          } catch (e) {}

          try {
            player.play(resource);
          } catch (e) {}
          joinChannel(channel.id);
        });
      })
      .catch(console.error);
  }
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  if (
    newState.channelId &&
    newState.channel.type === "GUILD_STAGE_VOICE" &&
    newState.guild.me.voice.suppress
  ) {
    try {
      await newState.guild.me.voice.setSuppressed(false);
    } catch (e) {}
  }
});

client.on("messageCreate", async (message, args) => {
  if (message.author.bot) return;

  if (message.content.toLowerCase().startsWith("!audio")) {
    var link = message.content.split(" ")[1];

    const espera = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const temp = "./temp/";
    const carpeta = "./audios/";

    const linkValido = ytdlCore.validateURL(link);

    if (linkValido) {
      message.delete();
      async function empezar() {
        message.channel.sendTyping();

        const info = await ytdlCore.getInfo(link);

        if (info.videoDetails.lengthSeconds < 30) {
          message.channel.send(`El vídeo debe durar al menos 30 segundos <@${message.author.id}>`);
          return;
        }

        let titulo = info.videoDetails.title;

        const tituloConFiltro = titulo.replace(/\W/g, "");
        const archivo = tituloConFiltro + ".mp3";
        const archivoFinal = carpeta + archivo;
        const carpetaTemp = temp + archivo;

        function carpetaVacia() {
          const files = fs.readdirSync(temp);
          if (files.length === 0) {
            return true;
          }
        }

        function borrarTemp() {
          if (!carpetaVacia(temp)) {
            fs.rmSync(temp, { recursive: true, force: true });
            fs.mkdirSync(temp);
          } else {
            return;
          }
        }
        borrarTemp();

        const msg = await message.channel.send(
          `:white_check_mark: Descargando **${titulo}**... | Pedido por ${message.author.tag}`
        );

        function descargar() {
          ytdlCore(link, {
            filter: "audioonly",
            quality: "highestaudio",
            format: "opus",
          }).pipe(fs.createWriteStream(carpetaTemp));
        }

        descargar();

        await espera(1000);

        await msg
          .edit(
            `:arrow_up: Subiendo el archivo de audio de **${titulo}** al chat... | Pedido por ${message.author.tag}`
          )
          .catch(async (e) => {
            await msg.edit(
              `:x: Ha sucedido un error al subir **${titulo}** al chat. Simplemente vuelve a intentarlo. (es bastante poco probable que suceda este error)`
            );
            console.log(e);
          });

        await espera(3000);

        await enviarAudio();

        async function enviarAudio() {
          if (fs.existsSync(carpetaTemp)) {
            if (fs.statSync(carpetaTemp).size < 400000) {
              await msg.edit(
                `:x: Hubo un error con el archivo de audio de **${titulo}**.\nReintentado la descarga...`
              );
              await espera(2000);
              await msg.delete();
              await empezar();
            } else {
              fs.copyFileSync(carpetaTemp, archivoFinal);
              await msg
                .edit({
                  content: `:white_check_mark: Se ha completado la subida de **${titulo}**\n:arrow_down: Aquí tienes tu archivo de audio ${message.author.tag} :arrow_down:`,
                  files: [archivoFinal],
                })
                .catch(async (e) => {
                  await msg.edit(
                    `:x: Ha sucedido un error al subir **${titulo}** al chat. Simplemente vuelve a intentarlo. (es bastante poco probable que suceda este error)`
                  );
                  fs.unlink(archivoFinal, (err) => {
                    if (err) throw err;
                  });
                  console.log(e);
                });

              fs.unlink(archivoFinal, (err) => {
                if (err) throw err;
              });
            }
          }
        }
      }
      await empezar();
    } else {
      await message.channel.send(
        `:x: No se ha podido descargar el audio. | El link no es válido.`
      );
    }
  }
});

client.login(token);
