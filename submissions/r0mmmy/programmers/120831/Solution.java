class Solution {
    public int solution(int n) {
        int answer = 0;
        for (int i = 1; i <= n/2; i++){
            answer += i*2;
        }
        return answer;
    }
}