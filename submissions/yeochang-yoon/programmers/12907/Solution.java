import java.util.*;

class Solution {
    public int solution(int n, int[] money) {
        
        Arrays.sort(money);
        int len = money.length;
        
        int[][] dp = new int[money[len-1]+1][n+1];
        
        
        for(int i = 0; i < len; i++){
            dp[money[i]][0] = 1;
        }
        
        
        
        for(int i = money[0]; i <= n; i++){
            for(int j = 0; j < money.length; j++){
                for(int k = j; k < money.length; k++){
                    if(money[k] <= i){
                        dp[money[j]][i] += dp[money[k]][i-money[j]];
                        dp[money[j]][i] %= 1000000007;
                    }
                }
            }
        }
        
        int sum = 0;
        for(int i = 0; i < money.length; i++){
            sum += dp[money[i]][n];
        }
        int answer = sum;
        return answer;
    }
}