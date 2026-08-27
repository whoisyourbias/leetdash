class Solution {
    public int solution(String num_str) {
        int answer = 0;
        for (int x=0;x<num_str.length();x++){
            answer += num_str.charAt(x)-'0';
        }
        return answer;
    }
}