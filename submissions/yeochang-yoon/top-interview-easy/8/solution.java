class Solution {
    public int myAtoi(String s) {
        //1. 부호 나오기 직전까지 공백을 제거 부호 한번 나오고 나면 끝 없이 숫자만 나오면 3번으로
        //2. 부호가 나오면 그 뒤에는 숫자만 가능
        //3. 0~9가 아니면 스탑, 숫자 없으면 0출력
        //4. 0은 맨앞에 있다면 제거


        int n = s.length();

        int[] arr = new int[n];

        boolean 부호나옴 = false;
        boolean 숫자나옴 = false;
        boolean 음수임 = false;
        int count = 0;

        for(int i = 0; i < n; i++){
            if(부호나옴 || 숫자나옴){
                if(s.charAt(i) < '0' || s.charAt(i) > '9'){
                    break;
                }
            }

            if(!부호나옴 && !숫자나옴){
                if(s.charAt(i) != ' ' && s.charAt(i) != '+' && s.charAt(i) != '-' && (s.charAt(i) < '0' || s.charAt(i) > '9')){
                    break;
                }
            }

            if(!부호나옴 && s.charAt(i) == '+'){
                부호나옴 = true;
            }
            if(!부호나옴 && s.charAt(i) == '-'){
                음수임 = true;
                부호나옴 = true;
            }

            if(s.charAt(i) >= '0' && s.charAt(i) <= '9'){
                arr[count] = s.charAt(i) - '0';
                count++;
                숫자나옴 = true;
            }
        }

        int result = 0;

        for(int i = 0; i < count; i++){
            if(!음수임 && (result > Integer.MAX_VALUE/10 || (result == Integer.MAX_VALUE/10 && arr[i] > 7))){
                return Integer.MAX_VALUE;
            }
            if(음수임 && (result < Integer.MIN_VALUE/10 || (result == Integer.MIN_VALUE/10 && arr[i] > 8))){
                return Integer.MIN_VALUE;
            }

            if(음수임){
                result = result * 10 + (-arr[i]);
            } else {
                result = result * 10 + arr[i];
            }
        }

        return result;
    }
}