#!/bin/bash

echo "Checking for remoddler update..."
str1=`cat $1/latest`
str2=`curl -s https://zoliqe.github.io/dist/remoddler/latest`
#echo "local:  $str1"
#echo "remote: $str2"

if [[ "$str1" == "$str2" ]]; then
    echo ""
else
    echo "Timestamps differs, downloading update."
    pkill remoddler
    curl https://zoliqe.github.io/dist/remoddler/remoddler.exe --output $1/remoddler.exe
    curl https://zoliqe.github.io/dist/remoddler/latest --output $1/latest
fi


