cd
#cd remoddler
#dart pub get
#cd bin
#echo "Compiling remoddler..."
#dart compile exe remoddler.dart

# echo "Compiling audio..."
# ./gcc_audio.sh

# echo "Compiling paddle..."
# ./gcc_paddle.sh

#echo "Installing rc.local..."
#sudo cp rc.local /etc/
#sudo chmod +x /etc/rc.local
#sudo chown root:root /etc/rc.local

cp Remoddle.desktop ~/Desktop/
mkdir ~/.config/autostart
ln -s ~/Desktop/Remoddle.desktop ~/.config/autostart/
