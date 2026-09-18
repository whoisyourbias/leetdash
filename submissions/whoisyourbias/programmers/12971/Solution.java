class Solution {
    public int solution(int sticker[]) {
        int answer = 0;

        // 원형 DP풀이법은 1 ~ N 1번하고, 0 ~ N-1 1번해서 최대값찾는거.
        if (sticker.length == 1)
            return sticker[0];
        if (sticker.length == 2)
            return Math.max(sticker[0], sticker[1]);
        
        answer = Math.max(dp(sticker, 1, sticker.length),
                         dp(sticker, 0, sticker.length - 1)
                         );
        return answer;
    }
    
    int dp(int[] sticker, int from, int to) {
        int[] chosen = new int[sticker.length];
        
        chosen[0] = sticker[from];
        chosen[1] = Math.max(sticker[from], sticker[from + 1]);
        
        for (int i = from + 2; i < to; i++) {
            // 현재를 선택하면 얻는 결과값
            chosen[i] = Math.max(chosen[i-1], sticker[i] + chosen[i-2]);
        }
        return chosen[to-1];
    }
}