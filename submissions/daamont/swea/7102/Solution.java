import java.util.Scanner;

/*
   사용하는 클래스명이 Solution 이어야 하므로, 가급적 Solution.java 를 사용할 것을 권장합니다.
   이러한 상황에서도 동일하게 java Solution 명령으로 프로그램을 수행해볼 수 있습니다.
 */
class Solution
{
	public static void main(String args[]) throws Exception
	{
		Scanner sc = new Scanner(System.in);
		int T;
		T=sc.nextInt();

		for(int test_case = 1; test_case <= T; test_case++)
		{
		
			 int N = sc.nextInt();
            int M = sc.nextInt();

            int min = Math.min(N, M);
            int max = Math.max(N, M);

            System.out.print("#" + test_case);

            for (int i = min + 1; i <= max + 1; i++) {
                System.out.print(" " + i);
            }

            System.out.println();

		}
	}
}