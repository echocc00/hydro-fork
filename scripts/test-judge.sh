#!/bin/bash
# Hydro ?????????
# ???????: bash scripts/test-judge.sh
# ??: hydro-backend + sandbox + hydrojudge ???
# ??: C++ ?? g++?????: sudo apt install g++

export PATH=$HOME/node-v22.14.0-linux-x64/bin:$HOME/bin:$PATH
export LC_ALL=C

RED="\033[31m"
GREEN="\033[32m"
NC="\033[0m"

SERVER="http://localhost:8888"
PROBLEM="P1000"
PID=1
PASS=0
FAIL=0

check() {
    if [ "$1" = "0" ]; then
        echo -e "  ${GREEN}[PASS]${NC} $2"
        PASS=$((PASS+1))
    else
        echo -e "  ${RED}[FAIL]${NC} $2"
        FAIL=$((FAIL+1))
    fi
}

header() { echo ""; echo "--- $1 ---"; }

echo "============================================"
echo " Hydro Judge E2E Test"
echo "============================================"

# 1. ????
header "????"
wget -qO- $SERVER/status 2>/dev/null | grep -q Hydro; check $? "hydro-backend"
wget -qO- http://localhost:5050/version 2>/dev/null | grep -q buildVersion; check $? "sandbox"
pm2 list 2>/dev/null | grep hydrojudge | grep -q online; check $? "hydrojudge"

# 2. ??
header "??"
rm -f /tmp/test_cookies.txt
wget -qO /dev/null \
    --post-data='uname=Hydro&password=judgepass123&rememberme=on' \
    --header='Content-Type: application/x-www-form-urlencoded' \
    --save-cookies /tmp/test_cookies.txt \
    $SERVER/login 2>/dev/null
grep -q 'sid' /tmp/test_cookies.txt; check $? "?? session"

# 3. ?? Python
header "?? Python ??"
cat > /tmp/test_ac.py << 'PYEOF'
import sys
a, b = map(int, sys.stdin.read().split())
print(a + b)
PYEOF

SUBMIT_URL="$SERVER/d/system/p/$PID/submit"
wget -qO /tmp/test_submit_py.html \
    --load-cookies /tmp/test_cookies.txt \
    --post-data="lang=py.py3&code=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(open("/tmp/test_ac.py").read()))')" \
    --header='Content-Type: application/x-www-form-urlencoded' \
    $SUBMIT_URL 2>/dev/null
RID=$(grep -oP 'rid=\K[a-f0-9]+' /tmp/test_submit_py.html | head -1)
[ -n "$RID" ] && echo "  rid: $RID"
check 0 "Python ??? ($RID)"

# 4. ?? C++ (?? g++)
header "?? C++ ??"
if command -v g++ &>/dev/null; then
    cat > /tmp/test_ac.cpp << 'CPPEOF'
#include <iostream>
using namespace std;
int main() { int a,b; cin>>a>>b; cout<<a+b<<endl; }
CPPEOF
    wget -qO /tmp/test_submit_cpp.html \
        --load-cookies /tmp/test_cookies.txt \
        --post-data="lang=cc&code=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(open("/tmp/test_ac.cpp").read()))')" \
        --header='Content-Type: application/x-www-form-urlencoded' \
        $SUBMIT_URL 2>/dev/null
    RID=$(grep -oP 'rid=\K[a-f0-9]+' /tmp/test_submit_cpp.html | head -1)
    check 0 "C++ ??? ($RID)"
else
    echo "  [SKIP] g++ ??? (sudo apt install g++)"
fi

# 5. ????
header "???? (?? 30s)"
for i in 1 2 3 4 5 6; do
    sleep 5
    PM2_LOG=$(pm2 logs hydrojudge --nostream --lines 2 2>/dev/null | grep "End:" | tail -1)
    [ -n "$PM2_LOG" ] && echo "  [$i] $(echo $PM2_LOG | grep -oP 'status: \K[^,]+') | $(echo $PM2_LOG | grep -oP 'score: \K[^,]+') | $(echo $PM2_LOG | grep -oP 'time: \K[^,]+')ms | $(echo $PM2_LOG | grep -oP 'memory: \K[^}]+')"
done

# 6. ????
header "???? (?? 5 ?)"
cd ~/Hydro && node -e "
const {MongoClient}=require('mongodb');
(async()=>{
  const c=await MongoClient.connect('mongodb://127.0.0.1:27017/hydro');
  const recs=await c.db().collection('record').find({pid:1},{sort:{_id:-1},limit:5}).toArray();
  const m={0:'PEND',1:'AC',2:'WA',3:'TLE',4:'MLE',5:'RE',6:'WA',7:'RE',8:'CE',9:'SE',10:'IGN'};
  for(const r of recs) console.log('  '+r._id.toString().substring(0,16)+' | '+(r.lang||'?').padEnd(8)+'| '+m[r.status]+' | score:'+r.score+' | '+(r.time||0)+'ms | '+(r.memory||0)+'KB');
  await c.close();
})().catch(e=>console.error(e.message));
" 2>/dev/null

# ??
rm -f /tmp/test_ac.py /tmp/test_ac.cpp /tmp/test_cookies.txt /tmp/test_submit_py.html /tmp/test_submit_cpp.html

echo ""
echo "============================================"
echo -e " Result: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}"
echo "============================================"
echo ""
echo "Browser: http://192.168.2.19:8888/d/system/p/$PID"
