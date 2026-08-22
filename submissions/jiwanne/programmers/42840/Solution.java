class Solution {
    public int[] solution(int[] answers) {
        int[] answer = {0,0,0};
        
        int a = answers.length;
        
        int[] f = {1,2,3,4,5};
        int[] s = {2,1,2,3,2,4,2,5};
        int[] t = {3,3,1,1,2,2,4,4,5,5};
        
        for(int i = 0; i < a; i++) {
            
            if(answers[i] == f[i % f.length]) {
                answer[0]++;
            }
            if(answers[i] == s[i % s.length]) {
                answer[1]++;
            }
            if(answers[i] == t[i % t.length]) {
                answer[2]++;
            }
            
        }
        
        int max = Math.max(answer[0], Math.max(answer[1] , answer[2]));
        
        int cnt = 0;
        
        for(int i = 0; i < 3; i++) {
            if(answer[i] == max ) {
                cnt++;
            }
        }
        
        int[] result = new int [cnt];
        
        int idx = 0;
        
        for(int i = 0; i < 3; i++) {
            if(answer[i] == max) {
                result[idx++] = i + 1;
            }
        }
        
        
        
        return result;
    }
}