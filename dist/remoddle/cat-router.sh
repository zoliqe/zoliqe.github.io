# Počúva na TCP porte 4532 a zároveň ako WebSocket server na porte 8074, 
# pričom obojsmerne preposiela správy:
while true; do
    /home/om4aa/websocat --text --exit-on-eof ws-l:0.0.0.0:8074 chunks:tcp-l:0.0.0.0:4532
    sleep 3
done
