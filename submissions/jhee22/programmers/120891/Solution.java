// 3,6,9 일 때 박수 침 
class Solution {
    public int solution(int order) {
        int answer = 0;
        String str_order = String.valueOf(order); 
        for (int i = 0; i < str_order.length(); i++) {
            if (str_order.charAt(i) == '3' || str_order.charAt(i) == '6' || str_order.charAt(i) == '9') {
                answer++; 
            } 
        }
        return answer;
    }
}