import java.util.*;

class Solution {
    public int solution(int n, int[] stations, int w) {
        int answer = 0;       
        // 아직 커버되지 않은 왼쪽끝
        int left = 1;
        double coverageW = w * 2 + 1;
        for (int s : stations) {
            // 현재 기지국 기준 왼쪽끝과 오른쪽끝
            int lend = Math.max(1, s - w);
            int rend = Math.min(n, s + w);
            
            if (left < lend) {
                int v = (int) Math.ceil((double)(lend-1 + 1 - left) / coverageW);
                answer += v;
            }
            left =rend + 1;
        }
        if (left <= n) {
            int v = (int) Math.ceil((double)(n + 1 - left) / coverageW);
            answer += v;
        }
        return answer;
    }
}