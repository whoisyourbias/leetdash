class Solution
{
    public int solution(String s)
    {
        int n = s.length();
        
        int max = 1;
        //홀수인경우
        for(int i = 1; i < n-1; i++){
            int left = i-1;
            int right = i+1;
            
            while(left >= 0 && right < n){
                if(s.charAt(left) != s.charAt(right)){
                    break;
                }
                left--;
                right++;
            }
            
            int len = (--right) - (++left) + 1;
            
            max = Math.max(max, len);
        }
        
        //짝수인경우
        for(int i = 0; i < n-1; i++){
            int left = i;
            int right = i+1;
            
            while(left >= 0 && right < n){
                if(s.charAt(left) != s.charAt(right)){
                    break;
                }
                left--;
                right++;
            }
            
            int len = (--right) - (++left) + 1;
            
            max = Math.max(max, len);
        }
        return max;
    }
}