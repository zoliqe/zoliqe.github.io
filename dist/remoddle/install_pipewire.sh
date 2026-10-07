#! /bin/bash
# Make sure only root can run our script
if [[ $EUID -ne 0 ]] ; then
  echo "This script must be run as root." 1>&2
  echo "For example, run the script as follows:" 1>&2
  echo "   sudo $0" 1>&2
  exit 1
fi

# apt-get --yes --allow-change-held-packages install --no-install-recommends \
# 	wireplumber pipewire pipewire-alsa pipewire-audio-client-libraries pipewire-jack \
# 	pipewire-pulse pipewire-bin libspa-0.2-bluetooth pulseaudio-utils alsa-utils \
# 	lpplug-bluetooth wfplug-bluetooth lpplug-volumepulse wfplug-volumepulse \
# 	libpipewire-0.3-common libspa-0.2-modules bluez bluez-tools bluez-obexd
apt-get --yes --allow-change-held-packages install --no-install-recommends \
	wireplumber pipewire pipewire-alsa pipewire-audio-client-libraries pipewire-jack \
	pipewire-pulse pipewire-bin pulseaudio-utils alsa-utils \
	lpplug-volumepulse wfplug-volumepulse \
	libpipewire-0.3-common libspa-0.2-modules

# if [[ -z "$(grep "Class = 0x200414" /etc/bluetooth/main.conf)" ]] ; then
#   # The following two timeouts are expressed in seconds
#   sed -i 's/^#DiscoverableTimeout.*/DiscoverableTimeout = 180/g'  /etc/bluetooth/main.conf
#   sed -i 's/^#PairableTimeout.*/PairableTimeout = 180/g'  /etc/bluetooth/main.conf
#   sed -i 's/^#FastConnectable.*/FastConnectable = true/g'  /etc/bluetooth/main.conf
#   sed -i 's/^#JustWorksRepairing.*/JustWorksRepairing = always/g'  /etc/bluetooth/main.conf
#   sed -i 's/^#Cache.*/Cache = yes/g'  /etc/bluetooth/main.conf
#   sed -i 's/^#Class.*/Class = 0x200414 #Present as an audio loudspeaker/g'  /etc/bluetooth/main.conf
#   sed -i 's/^#ReconnectAttempts.*/ReconnectAttempts = 7/g'  /etc/bluetooth/main.conf
#   sed -i 's/^#ReconnectIntervals.*/ReconnectIntervals=1,2,4,8,16,32,64/g'  /etc/bluetooth/main.conf

#   # The following timeout is expressed in minutes
#   sed -i 's/^#IdleTimeout.*/IdleTimeout=180/g'  /etc/bluetooth/input.conf

#   # Modify the /etc/systemd/system/bluetooth.target.wants/bluetooth.service
#   sed -i '/ExecStart=./ s/$/ --noplugin=sap/' /lib/systemd/system/bluetooth.service
#   sed -i 's/^.*Restart=.*/Restart=always/g' /lib/systemd/system/bluetooth.service
# fi

# rfkill unblock bluetooth
# chmod 755 /var/lib/bluetooth

# CARD=$(aplay -l | grep card | grep Headphones | sed -e 's/^card[[:space:]]*//g; s/:.*//g')

# cat << EOF > /etc/asound.conf
# pcm.!default {
#   type hw
#   card ${CARD}
# }
# ctl.!default {
#   type hw
#   card ${CARD}
# }
# EOF

USERNAME=$(who am i)
DOLLAR="\$"

# Enable the services we just defined
usermod "${USERNAME}" -aG pi,audio,video,bluetooth 2> /dev/null

# Create an autologin session (no idea why, but this works and loginctl enable-linger "${USERNAME}" doesn't)
mkdir /etc/systemd/system/getty\@tty1.service.d
cat > /etc/systemd/system/getty\@tty1.service.d/autologin.conf << EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin ${USERNAME} --noclear %I ${DOLLAR}TERM
EOF

# Load the service file we just created and enable it
systemctl daemon-reload
systemctl restart getty@tty1.service

# echo "Now reboot and pair a device using bluetoothctl. Bluetooth should be working."
echo "Now reboot"

