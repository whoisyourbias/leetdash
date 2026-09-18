class Solution {
    int solution(int[][] land) {
        int answer = 0;

        int[][] dp = new int[land.length][4];
        
        for (int i = 0; i < land.length; i++) {
            for (int j = 0; j < 4; j++) {
                if (i == 0) {
                    dp[i][j] = land[i][j];
                    continue;
                }
                
                dp[i][j] = land[i][j] + max(dp, i, j);
            }
        }
        for (int i = 0; i < 4; i++) {
            answer = Math.max(answer, dp[land.length - 1][i]);
        }
        return answer;
    }
    
    int max(int[][] dp, int i, int j) {
        int max = -1;
        for (int k = 0; k < 4; k++) {
            if (k == j)
                continue;
            max = Math.max(dp[i-1][k], max);
        }
        return max;
    }
}