#cd
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

cp remoddle.sh ~/remoddle.sh
chmod +x ~/remoddle.sh
cp remoddler.exe ~/remoddler.exe
chmod +x ~/remoddler.exe
cp paddle.py ~/paddle.py
chmod +x ~/paddle.py
cp lcd.sh ~/lcd.sh
chmod +x ~/lcd.sh
cp lcd_print.sh ~/lcd_print.sh
chmod +x ~/lcd_print.sh
cp remoddler.yaml ~/remoddler.yaml
cp latest ~/latest
cp -r bundle/* ~/
chmod +x ~/rigller
ln -s ~/rigller ~/rigller.exe
