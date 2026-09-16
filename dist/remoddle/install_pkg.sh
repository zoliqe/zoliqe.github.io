cd

sudo apt update
#sudo apt install -y evtest libasound2-dev libgpiod-dev lighttpd
sudo apt install -y evtest lighttpd python3-libgpiod
pip install --break-system-packages pasimple

wget https://github.com/snapcast/snapcast/releases/download/v0.35.0/snapclient_0.35.0-1_arm64_trixie_with-pipewire.deb
sudo dpkg -i snapclient_0.35.0-1_arm64_trixie_with-pipewire.deb
sudo apt install -f -y
sudo systemctl stop snapclient
sudo systemctl disable snapclient

#wget https://storage.googleapis.com/dart-archive/channels/stable/release/3.11.0/sdk/dartsdk-linux-arm64-release.zip
#unzip dartsdk-linux-arm64-release.zip
#p='$HOME/dart-sdk/bin:$PATH'
#echo "export PATH=$p" >>.profile
