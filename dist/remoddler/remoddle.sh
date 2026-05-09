#!/bin/bash
dir=$HOME

echo "Checking for remoddle update..."
str1=`cat $dir/latest`
str2=`curl -s https://zoliqe.github.io/dist/remoddler/latest`
#echo "local:  $str1"
#echo "remote: $str2"

if [[ "$str1" == "$str2" ]]; then
    echo ""
else
    echo "Timestamps differs, downloading update."
    pkill remoddler
    curl https://zoliqe.github.io/dist/remoddler/remoddler.exe --output $1/remoddler.exe
    curl https://zoliqe.github.io/dist/remoddler/rigller.exe --output $1/rigller.exe
    curl https://zoliqe.github.io/dist/remoddler/latest --output $1/latest
fi

echo "Starting remoddle service..."
enc0=`journalctl | grep "input: rotary@14" | awk '{print $9}' - | awk -F '/' '{print $6}' -`
$dir/remoddler.exe --debug -d $dir $enc0 &

sleep 0.5
sudo $dir/remoddler/bin/lcd.sh Hello ready

echo "Starting rig controller..."
$dir/rigller.exe
pkill remoddler

sudo shutdown

