import java.util.Scanner;

class Solution
{
	public static void main(String args[]) throws Exception
	{
		
		Scanner sc = new Scanner(System.in);
		int T;
		T=sc.nextInt();
		
		for(int test_case = 1; test_case <= T; test_case++)
		{
			int a =sc.nextInt();
			int b = sc.nextInt();
			int c= sc.nextInt();
			int count = 0;
			if(a<=b) {
				count += c/a;
			}else {
				count += c/b;
			}
			
			System.out.println("#"+test_case+ " " + count);
		}
		
	}
}
