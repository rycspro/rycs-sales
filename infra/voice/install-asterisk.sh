#!/usr/bin/env bash
set -euo pipefail

# RYCS Voice — Instalação do Asterisk 20 LTS no Ubuntu 22.04
# Uso: sudo bash install-asterisk.sh
# Pré-requisito: EC2 t3.medium, Ubuntu 22.04, 50GB gp3

ASTERISK_VERSION="20-current"
ARI_USER="${ARI_USER:-rycs-voice}"
ARI_PASS="${ARI_PASS:?Defina ARI_PASS antes de executar}"

echo "=== RYCS Voice — Instalação Asterisk ==="
echo "Versão: $ASTERISK_VERSION"
echo "Usuário ARI: $ARI_USER"

# 1. Dependências
apt-get update && apt-get upgrade -y
apt-get install -y \
  build-essential wget curl git \
  libssl-dev libncurses5-dev libnewt-dev libxml2-dev \
  linux-headers-"$(uname -r)" libsqlite3-dev uuid-dev \
  libjansson-dev libsrtp2-dev libpjproject-dev \
  unixodbc-dev libcurl4-openssl-dev libedit-dev \
  certbot fail2ban ufw jq

# 2. Compilar Asterisk
cd /usr/local/src
wget -q "https://downloads.asterisk.org/pub/telephony/asterisk/asterisk-${ASTERISK_VERSION}.tar.gz"
tar xzf "asterisk-${ASTERISK_VERSION}.tar.gz"
cd asterisk-20.*/

contrib/scripts/get_mp3_source.sh || true
./configure --with-pjproject-bundled --with-jansson-bundled

# Habilitar módulos necessários via menuselect não-interativo
make menuselect.makeopts
menuselect/menuselect \
  --enable res_pjsip \
  --enable res_pjsip_transport_websocket \
  --enable res_ari \
  --enable res_ari_channels \
  --enable res_ari_bridges \
  --enable res_ari_recordings \
  --enable res_ari_events \
  --enable res_http_websocket \
  --enable codec_opus \
  --enable res_stasis \
  --enable bridge_simple \
  --enable bridge_native_rtp \
  menuselect.makeopts

make -j"$(nproc)"
make install
make config
ldconfig

# 3. Usuário asterisk
id -u asterisk &>/dev/null || adduser --system --group --no-create-home asterisk
chown -R asterisk:asterisk /var/{run,lib,log,spool}/asterisk
chown -R asterisk:asterisk /etc/asterisk

# 4. Diretórios de gravação
mkdir -p /var/spool/asterisk/recording
chown asterisk:asterisk /var/spool/asterisk/recording

# 5. Configurar para rodar como asterisk
sed -i 's/^;runuser = asterisk/runuser = asterisk/' /etc/asterisk/asterisk.conf
sed -i 's/^;rungroup = asterisk/rungroup = asterisk/' /etc/asterisk/asterisk.conf

echo "=== Asterisk instalado. Execute apply-configs.sh para configurar. ==="
