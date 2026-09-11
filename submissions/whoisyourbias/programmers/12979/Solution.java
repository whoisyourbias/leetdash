import java.util.*;

class Solution {
    class Interval {
        int from;
        int to;
        Interval(int from, int to) {this.from=from;this.to=to;}
        @Override
        public String toString() {
            return "from"+from +"|"+"to"+to;
        }
    }
    public int solution(int n, int[] stations, int w) {
        int answer = 0;

        ArrayList<Interval> lst = new ArrayList<>();
        
        int left = 1;
        for (int s : stations) {
            // 현재 기지국 기준 왼쪽끝과 오른쪽끝
            int lend = Math.max(1, s - w);
            int rend = Math.min(n, s + w);
            
            if (lend - 1 - left > 0) {
                lst.add(new Interval(left, lend - 1));
            }
            left = rend + 1;
        }
        if (n - left - 1 > 0)
            lst.add(new Interval(left, n));
        
        int coverageW = w * 2 + 1;
        for (Interval i : lst) {
           // System.out.println(i);
            if ((i.to - i.from) % coverageW == 0) {
                answer += (i.to - i.from) / coverageW;
            } else {
                answer += 1 + (i.to - i.from) / coverageW;    
            }        
        }
        return answer + 1;
    }
}