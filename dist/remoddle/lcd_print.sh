# https://forums.raspberrypi.com/viewtopic.php?t=285415
printf "\f\e[H" >/dev/lcd
printf "$1\n$2" >/dev/lcd
