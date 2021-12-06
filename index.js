const { Client, Intents, MessageEmbed } = require("discord.js");
require("dotenv").config();

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
} = require("@discordjs/voice");
const ytdlCore = require("ytdl-core");
const fs = require("fs");
const { SlashCommandBuilder } = require("@discordjs/builders");

const client = new Client({
  shards: "auto",
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_VOICE_STATES,
    Intents.FLAGS.GUILD_MESSAGES,
  ],
});

const Canales = ["827144251384659978", "826950998740303942"];

client.on("ready", async () => {
  console.log(`Iniciado sesión como ${client.user.username}`);

  client.user.setPresence({
    activities: [{ name: "/audio", type: "WATCHING" }],
    status: "online",
  });

  for (const IDdelCanal of Canales) {
    unirseAlCanal(IDdelCanal);
    await new Promise((res) => setTimeout(() => res(2), 500));
  }

  function unirseAlCanal(channelId) {
    client.channels
      .fetch(channelId)
      .then((channel) => {
        const conexionDeVoz = joinVoiceChannel({
          channelId: channel.id,
          guildId: channel.guild.id,
          adapterCreator: channel.guild.voiceAdapterCreator,
        });

        const audioDeRadio = createAudioResource(
          "https://streams.ilovemusic.de/iloveradio109.mp3",
          {
            inlineVolume: true,
          }
        );
        audioDeRadio.volume.setVolume(0.2);
        const reproductor = createAudioPlayer();
        conexionDeVoz.subscribe(reproductor);
        reproductor.play(audioDeRadio);
        reproductor.on("idle", () => {
          try {
            reproductor.play(audioDeRadio);
          } catch (e) {}
          unirseAlCanal(channel.id);
        });
        reproductor.on("error", (e) => {
          console.log(e);
          reproductor.play(audioDeRadio);
        });
      })
      .catch(console.error);
  }
});

const comandosSlash = [];

const comandoAudio = new SlashCommandBuilder()
  .setName("audio")
  .setDescription("Descarga el audio de cualquier vídeo de YouTube")
  .addStringOption((opción) => {
    opción.setName("link");
    opción.setDescription(
      "El link del vídeo del que quieres descargar el audio"
    );
    opción.setRequired(true);
    return opción;
  });

comandosSlash.push(comandoAudio.toJSON());

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content.toLowerCase().startsWith("!d")) {
    message.guild.commands.set(comandosSlash).catch(console.error);
    message.channel
      .send(
        `Se han desplegado ${comandosSlash.length} comandos en ${message.guild.name}`
      )
      .catch(console.error);
  }
});

client.on("interactionCreate", async (interacción) => {
  if (!interacción.isCommand()) return;

  if (interacción.commandName === "audio") {
    const link = interacción.options.getString("link");

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
      async function empezar() {
        const info = await ytdlCore.getInfo(link);

        let titulo = info.videoDetails.title;

        let tituloConFiltro = titulo.replace(/\W/g, "");
        if (tituloConFiltro === "") {
          tituloConFiltro = "audio";
        }

        let archivo = tituloConFiltro + ".mp3";
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

        let embed = new MessageEmbed()
          .setTitle("<a:bien:888522953048862770>  Descargando...")
          .setColor("#2f3136")
          .setDescription(`[${titulo}](${link})`)
          .setImage(info.videoDetails.thumbnails[3].url)
          .setFooter(
            `Petición de ${interacción.member.user.tag}`,
            interacción.member.user.avatarURL()
          );

        await interacción.reply({ embeds: [embed] });

        if (info.videoDetails.lengthSeconds > 600) {
          embed
            .setTitle("<a:mal:888523182988992572>  El vídeo és demasiado largo")
            .setColor("#ff0000");
          await interacción.editReply({ embeds: [embed], ephemeral: true });
          return;
        }

        await descargar();

        async function descargar() {
          new Promise(async (resolve) => {
            let tiempoDeInicio;
            const video = ytdlCore(link, {
              filter: "audioonly",
              o: "-",
              f: "bestaudio[ext=webm+acodec=opus+asr=48000]/bestaudio",
              r: "100K",
            });
            video.pipe(fs.createWriteStream(carpetaTemp));
            video.once("response", () => {
              tiempoDeInicio = Date.now();
            });
            let tiempoPasado = 0;
            let pesaMenosDe8MB = true;
            video.once("progress", (algoQueNoNecesito, descargado, total) => {
              if ((total / 1024 / 1024).toFixed(2) > 8) {
                pesaMenosDe8MB = false;
                embed
                  .setTitle(
                    "<a:mal:888523182988992572>  El vídeo pesa más de 8 megabytes"
                  )
                  .setColor("#ff0000")
                  .setDescription("")
                  .setImage()
                  .setFooter(
                    "El vídeo dura demasiado, lo que significa que la descarga supera los 8 megabytes que pone Discord como límite"
                  );

                interacción.editReply({ embeds: [embed], ephemeral: true });
                return video.destroy();
              }
            });
            video.on(
              "progress",
              async (algoQueNoNecesito, descargado, total) => {
                if (Date.now() - tiempoPasado > 3000 && pesaMenosDe8MB) {
                  tiempoPasado = Date.now();
                  const porcentaje = descargado / total;
                  const tiempoQueLlevaDescargando =
                    (Date.now() - tiempoDeInicio) / 1000 / 60;
                  const tiempoEstimado =
                    tiempoQueLlevaDescargando / porcentaje -
                    tiempoQueLlevaDescargando;

                  embed
                    .setTitle("<a:bien:888522953048862770>  Descargando...")
                    .setColor("#2f3136")
                    .setDescription(`[${titulo}](${link})`)
                    .setImage(info.videoDetails.thumbnails[3].url)
                    .setFooter(
                      `Petición de ${interacción.member.user.tag}`,
                      interacción.member.user.avatarURL()
                    )
                    .setFields([
                      {
                        name: "Descargado",
                        value: `${(porcentaje * 100).toFixed(2)}%`,
                        inline: true,
                      },
                      {
                        name: "Tiempo transcurrido",
                        value: `${tiempoQueLlevaDescargando.toFixed(
                          2
                        )} minutos`,
                        inline: true,
                      },
                      {
                        name: "Tiempo estimado",
                        value: `${tiempoEstimado.toFixed(2)} minutos`,
                        inline: true,
                      },
                      {
                        name: "Peso",
                        value: `${(descargado / 1024 / 1024).toFixed(
                          2
                        )} MB de ${(total / 1024 / 1024).toFixed(
                          2
                        )} MB han sido descargados`,
                        inline: true,
                      },
                    ]);
                  interacción.editReply({ embeds: [embed] });
                } else {
                  return;
                }
              }
            );
            video.on("finish", async () => {
              resolve();
            });

            await espera(1000);
          }).then(async () => {
            embed
              .setTitle("<a:bien:888522953048862770>  Descarga completada")
              .setColor("#00ff00")
              .setDescription(`:arrow_up: Subiendo audio al chat...`)
              .setFields([]);
            await interacción.editReply({ embeds: [embed] });
            await enviarAudio();
          });
        }

        async function enviarAudio() {
          if (fs.existsSync(carpetaTemp)) {
            if (
              fs.statSync(carpetaTemp).size < 1000000 &&
              info.videoDetails.lengthSeconds > 60
            ) {
              embed
                .setTitle(
                  "<a:mal:888523182988992572>  Hubo un error con el archivo de audio"
                )
                .setColor("#ff0000")
                .setDescription(`Reintentando la descarga...`)
                .setFields([]);
              await interacción.editReply({ embeds: [embed], ephemeral: true });
              await espera(1500);
              await interacción.deleteReply();
              await empezar();
            } else {
              fs.renameSync(carpetaTemp, archivoFinal);
              embed
                .setTitle("<a:bien:888522953048862770>  Proceso completado")
                .setColor("#2f3136")
                .setImage()
                .setThumbnail(info.videoDetails.thumbnails[3].url)
                .setDescription(
                  `Se ha subido al chat:\n**[${titulo}](${link})**`
                )
                .setFields([]);
              await interacción
                .editReply({
                  embeds: [embed],
                  files: [archivoFinal],
                })
                .catch(async (e) => {
                  embed
                    .setTitle(
                      "<a:mal:888523182988992572>  Ha sucedido un error al subir el archivo de audio"
                    )
                    .setColor("#ff0000")
                    .setDescription(`Simplemente vuelve a intentarlo.`)
                    .setFields([]);
                  await interacción.editReply({
                    embeds: [embed],
                    ephemeral: true,
                  });
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
      let embed = new MessageEmbed()
        .setTitle("<a:mal:888523182988992572>  El link no es válido")
        .setColor("#ff0000")
        .setDescription(`No se ha podido descargar el audio.`)
        .setFields([])
        .setImage();
      await interacción.reply({ embeds: [embed], ephemeral: true });
    }
  }
});

client.login(process.env.TOKEN);
