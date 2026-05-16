#!/bin/bash
dir=$HOME

sleep 3
echo "Checking for remoddle update..."
str1=`cat $dir/latest`
str2=`curl -s https://zoliqe.github.io/dist/remoddle/latest`
#echo "local:  $str1"
#echo "remote: $str2"

if [[ "$str1" == "$str2" ]]; then
    echo ""
else
    echo "Timestamps differs, downloading update."
    pkill remoddler
    curl https://zoliqe.github.io/dist/remoddle/remoddler.exe --output $dir/remoddler.exe
    curl https://zoliqe.github.io/dist/remoddle/rigller.exe --output $dir/rigller.exe
    curl https://zoliqe.github.io/dist/remoddle/latest --output $dir/latest
fi

echo "Starting remoddle service..."
#enc0=`journalctl | grep "input: rotary@14" | awk '{print $9}' - | awk -F '/' '{print $6}' -`
$dir/remoddler.exe -d $dir &

sleep 0.5
sudo $dir/lcd.sh Hello ready

echo "Starting rig controller..."
$dir/rigller.exe
pkill remoddler

sleep 5
sudo shutdown

