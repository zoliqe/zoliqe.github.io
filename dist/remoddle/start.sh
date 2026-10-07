d=/home/om4aa
pidfile=/tmp/remoddle.pid
pid=$!

if [ -f $pidfile ]; then
    echo "remoddle: already running"
    exit 0
fi

$d/cat-router.sh >/dev/null &
$d/remotig_router.exe >/dev/null &
#$d/remoddle-pi.py >/dev/null &
$d/remoddle-pi-tone.py >/dev/null &

echo $pid >$pidfile
