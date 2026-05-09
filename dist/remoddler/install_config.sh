cfg="/boot/firmware/config.txt"
cfgval=`sudo cat $cfg | grep '# remoddle'`
if [ -z $cfgval ]; then
echo "Making changes in config.txt..."
sudo echo "# remoddle" >>$cfg
#dtoverlay=audremap,pins_12_13 \n\
sudo echo "dtoverlay=rotary-encoder,pin_a=20,pin_b=21,relative_axis=1" >>$cfg
#dtoverlay=rotary-encoder,pin_a=19,pin_b=26,relative_axis=1 \n" >> /boot/firmware/config.txt
fi

echo "enabling access to Serial hw..."
sudo raspi-config nonint do_serial_hw 0
echo "disabling console on Serial..."
sudo raspi-config nonint do_serial_cons 1