const { Client, Intents } = require("discord.js");
require("dotenv").config();

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
          joinChannel(channel.id);
        });
      })
      .catch(console.error);
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content.toLowerCase().startsWith("!audio")) {
    var link = message.content.split(" ")[1];

    const espera = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const temp = "./temp/";
    const carpeta = "./audios/";

    if (!fs.existsSync(temp)) {
      fs.mkdirSync(temp);
    }

    if (!fs.existsSync(carpeta)) {
      fs.mkdirSync(carpeta);
    }

    const linkValido = ytdlCore.validateURL(link);

    if (linkValido) {
      message.delete();
      async function empezar() {
        message.channel.sendTyping();

        const info = await ytdlCore.getInfo(link);

        let titulo = info.videoDetails.title;

        const tituloConFiltro = titulo.replace(/\W/g, "");
        const archivo = tituloConFiltro + ".mp3";
        const archivoFinal = carpeta + archivo;
        const carpetaTemp = temp + archivo;

        function carpetaVacia() {
          const files = fs.readdirSync(temp);
          if (!files.length === 0) {
            fs.rmSync(temp, { recursive: true, force: true });
            fs.mkdirSync(temp);
          } else {
            return;
          }
        }
        carpetaVacia();

        const msg = await message.channel.send(
          `:white_check_mark: Descargando **${titulo}**... | Pedido por ${message.author.tag}`
        );

        await descargar();

        async function descargar() {
          new Promise(async (resolve) => {
            ytdlCore(link, {
              filter: "audioonly",
              quality: "highestaudio",
              format: "opus",
            })
              .pipe(fs.createWriteStream(carpetaTemp))
              .on("finish", async () => {
                clearInterval(intervaloMensaje);
                resolve();
              });

            await espera(1000);

            const duracion = info.videoDetails.lengthSeconds;
            const segundos = duracion % 60;
            const minutos = (duracion - segundos) / 60;
            const tiempo = `${minutos} minutos y ${segundos} segundos`;

            const emojis = ["⬇⌛⌛", "⌛⬇⌛", "⌛⌛⬇"];
            const puntos = [".", "..", "..."];
            const descargando = ["Descargando", "**Descargando**"];

            const intervaloMensaje = setInterval(() => {
              msg.edit(
                `⬇ ${descargando[descargando.length - 1]} **${titulo}**${
                  puntos[puntos.length - 1]
                }\n👤 Pedido por ${
                  message.author.tag
                }\n:clock1: El vídeo dura ${tiempo}\n${
                  emojis[emojis.length - 1]
                } KiloBytes descargados: ${Math.floor(
                  (fs.statSync(carpetaTemp).size / 1024) * 100
                )} ${emojis[emojis.length - 1]}`
              );
              emojis.push(emojis.shift());
              puntos.push(puntos.shift());
              descargando.push(descargando.shift());
            }, 2000);
          }).then(async () => {
            await msg
              .edit(`:arrow_up: Subiendo audio al chat...`)
              .catch(async (e) => {
                await msg.edit(
                  `:x: Ha sucedido un error al subir **${titulo}** al chat. Simplemente vuelve a intentarlo. (es bastante poco probable que suceda este error)`
                );
                console.log(e);
              });
            await enviarAudio();
          });
        }

        async function enviarAudio() {
          if (fs.existsSync(carpetaTemp)) {
            if (fs.statSync(carpetaTemp).size > 8000000) {
              await msg.edit(
                `El archivo pesa más de 8 megabytes, con lo cual no puedo subirlo al chat.`
              );
              return;
            }
            if (
              fs.statSync(carpetaTemp).size < 1000000 &&
              info.videoDetails.lengthSeconds > 60
            ) {
              await msg.edit(
                `:x: Hubo un error con el archivo de audio de **${titulo}**.\nReintentado la descarga...`
              );
              await espera(1500);
              await msg.delete();
              await empezar();
            } else {
              fs.renameSync(carpetaTemp, archivoFinal);
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

client.login(process.env.TOKEN);
