#!/bin/bash
dir=$HOME
log=$dir/remoddle.log

sleep 3
pkill remoddle

echo "Checking for remoddle update..." >> $log
str1=`cat $dir/latest`
str2=`curl -s https://zoliqe.github.io/dist/remoddle/latest`
echo "local:  $str1" >> $log
echo "remote: $str2" >> $log

if [[ "$str1" == "$str2" ]]; then
    echo "Everything updated"
else
    echo "Timestamps differs, downloading update." >> $log
    curl https://zoliqe.github.io/dist/remoddle/remoddle.exe --output $dir/remoddle.exe >> $log
    chmod +x $dir/remoddle.exe
    curl https://zoliqe.github.io/dist/remoddle/paddle.py --output $dir/paddle.py >> $log
    chmod +x $dir/paddle.py
    curl https://zoliqe.github.io/dist/remoddle/remoddle.sh --output $dir/remoddle.sh >> $log
    chmod +x $dir/remoddle.sh
    # curl https://zoliqe.github.io/dist/remoddle/remoddle.yaml --output $dir/remoddle.yaml >> $log
    # curl https://zoliqe.github.io/dist/remoddle/rigller.exe --output $dir/rigller.exe >> $log
    curl https://zoliqe.github.io/dist/remoddle/latest --output $dir/latest
fi

echo "Starting remoddle service..." >> $log
#enc0=`journalctl | grep "input: rotary@14" | awk '{print $9}' - | awk -F '/' '{print $6}' -`
$dir/remoddle.exe -d $dir 2>&1 >> $log &

# sleep 0.5
# sudo $dir/lcd.sh Hello ready

# echo "Starting rig controller..." >> $log
# $dir/rigller.exe >> $dir/rigller.log 2>&1

# sleep 5
#sudo shutdown

