import java.util.Arrays;

class Solution {
    public int solution(int[] citations) {
        int answer = 0;
        // n 편중 h 번이상  h편 , 이하면 h의 최대값
        
        Arrays.sort(citations);
        
        for(int i = 0; i < citations.length; i++) {
            
            int h = citations.length - i;
            if(citations[i] >= h) {
                answer = h;
                break;
            }
        }
        
        return answer;
    }
}