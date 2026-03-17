morseeDir=/home/om4aa/morsee
remoddlerDir=/home/om4aa
# devout="plughw:CARD=Device,DEV=0"
# devout="default"
# bitrate=16000

$remoddlerDir/update.sh $remoddlerDir

#pull ups
# paddle
# pinctrl set 23 pu
# pinctrl set 24 pu
# enc sw
# pinctrl set 21 pu

#sudo dtoverlay audremap pins_12_13
#sudo dtoverlay rotary-encoder pin_a=20 pin_b=21 relative_axis=1
#sudo dtoverlay rotary-encoder pin_a=19 pin_b=26 relative_axis=1
# sudo dtoverlay hd44780-i2c-lcd addr=0x27 display_height=4 display_width=20
# sleep 1

enc0=`journalctl | grep "input: rotary@14" | awk '{print $9}' - | awk -F '/' '{print $6}' -`
#enc1=`journalctl | grep "input: rotary@4" | awk '{print $9}' - | awk -F '/' '{print $6}' -`
#enc1="none"
#echo "enc0: $enc0 enc1: $enc1"
$remoddlerDir/remoddler.exe -d $remoddlerDir $enc0
#echo "PID: $!"


#/usr/bin/evtest "/dev/input/$enc0" | grep --color=never value
